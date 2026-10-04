// Adapted from Cloudflare's Pi harness example (MIT, Copyright (c) 2025 Cloudflare, Inc.).
import type {
	AssistantMessage,
	ImageContent,
	JsonValue,
	Message,
	TextContent,
	UserMessage,
} from "@earendil-works/pi-ai";
import type { EntryRecord } from "@earendil-works/pi-durable";

export type PiMessagePart =
	| TextContent
	| ImageContent
	| { readonly type: "thinking"; readonly text: string }
	| {
			readonly type: "tool-call";
			readonly id: string;
			readonly name: string;
			readonly arguments: JsonValue;
	  }
	| {
			readonly type: "tool-result";
			readonly id: string;
			readonly name: string;
			readonly content: readonly (TextContent | ImageContent)[];
			readonly error: boolean;
			/** What the tool reported about itself, for example the session of a subagent. */
			readonly details?: JsonValue;
	  };

/** One display-ready message projected from a Pi transcript entry. */
export type PiMessage = {
	/** The Pi entry id, or `live` for the message being streamed. */
	readonly id: string;
	readonly role: "user" | "assistant" | "tool" | "notice";
	readonly parts: readonly PiMessagePart[];
	/** When Pi recorded the message, in milliseconds. */
	readonly timestamp?: number;
	readonly error?: string;
	/** The run was aborted while this assistant message was being written, usually by a Stop. */
	readonly stopped?: boolean;
	/** Another model answered because the chat's model failed before it produced output. */
	readonly fallback?: string;
};

// The diagnostic `agents/models/pi-ai` records when a fallback leg answered. The constant is
// copied so the client bundle does not pull in the provider module.
const FALLBACK_DIAGNOSTIC = "cloudflare-fallback";

function fallbackNotice(message: AssistantMessage): string | undefined {
	const diagnostic = message.diagnostics?.find((candidate) => candidate.type === FALLBACK_DIAGNOSTIC);
	const attempts = diagnostic?.details?.attempts;
	if (!Array.isArray(attempts) || attempts.length === 0) return undefined;
	const failed = attempts
		.map((attempt) => (typeof attempt === "object" && attempt !== null && "model" in attempt ? String(attempt.model) : undefined))
		.filter((model) => model !== undefined)
		.join(", ");
	return `${message.model} answered because ${failed} failed`;
}

function userParts(content: UserMessage["content"]): PiMessagePart[] {
	return typeof content === "string" ? [{ type: "text", text: content }] : content;
}

export function projectBlock(block: AssistantMessage["content"][number]): PiMessagePart {
	switch (block.type) {
		case "text":
			return { type: "text", text: block.text };
		case "thinking":
			return { type: "thinking", text: block.thinking };
		case "toolCall":
			return {
				type: "tool-call",
				id: block.id,
				name: block.name,
				arguments: block.arguments,
			};
	}
}

export function projectMessage(message: Message, id: string): PiMessage {
	switch (message.role) {
		case "system":
			// Pi records prompt changes as system entries; the UI does not show them.
			return { id, role: "notice", parts: [] };
		case "user":
			return { id, role: "user", parts: userParts(message.content), timestamp: message.timestamp };
		case "assistant":
			return {
				id,
				role: "assistant",
				parts: message.content.map((block) => projectBlock(block)),
				timestamp: message.timestamp,
				error: message.errorMessage ?? (message.stopReason === "error" ? "Model error" : undefined),
				stopped: message.stopReason === "aborted",
				fallback: fallbackNotice(message),
			};
		case "toolResult":
			return {
				id,
				role: "tool",
				timestamp: message.timestamp,
				parts: [
					{
						type: "tool-result",
						id: message.toolCallId,
						name: message.toolName,
						content: message.content,
						error: message.isError,
						details: message.details,
					},
				],
			};
	}
}

/**
 * Project one transcript entry. Entries that carry model messages become
 * the first one; a reset becomes a notice; system-prompt entries and other
 * bookkeeping have no projection.
 */
export function projectEntry(entry: EntryRecord): PiMessage | undefined {
	if (entry.kind === "pi.reset") {
		return {
			id: String(entry.id),
			role: "notice",
			parts: [{ type: "text", text: "Context reset" }],
		};
	}
	const message = entry.model?.[0];
	if (entry.kind === "pi.system" || message === undefined) return undefined;
	return projectMessage(message, String(entry.id));
}

export function projectEntries(entries: readonly EntryRecord[]): PiMessage[] {
	return entries.flatMap((entry) => {
		const message = projectEntry(entry);
		return message ? [message] : [];
	});
}
