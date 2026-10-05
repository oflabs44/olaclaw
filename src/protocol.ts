// Adapted from Cloudflare's Pi harness example (MIT, Copyright (c) 2025 Cloudflare, Inc.).
import type { AgentEvent, UsageState } from "@earendil-works/pi-durable";
import type { ModelId } from "./models";

/** The tool whose running call the chat renders as a question with buttons. */
export const ASK_TOOL = "ask";

/** The tool whose call the chat renders as a subagent, with the session in the call's details. */
export const DELEGATE_TOOL = "delegate";

/**
 * What a `delegate` call reports about itself. `conversationId`, `model`, and `startedAt` come as
 * soon as the subagent starts; `endedAt` and `usage` come with the result, so a finished card needs
 * no socket to show them.
 */
export type DelegateDetails = {
	conversationId: string;
	model: ModelId;
	startedAt: number;
	endedAt?: number;
	usage?: UsageState;
};

/** The tool whose running call the chat renders as code to approve. */
export const AYO_EXECUTE_TOOL = "ayo_execute";

/** The approval every `ayo_execute` call opens. Only the first option runs the code. */
export const AYO_EXECUTE_APPROVAL = {
	question: "Run this code in Ayo?",
	options: ["Run it", "Do not run"],
} as const;

/**
 * The params and code Oladayo reads before he approves an `ayo_execute` call, as one text. Every
 * character of the params outside printable ASCII shows as an escape, and the tool refuses code that
 * is not printable ASCII, so nothing can pass for something else on screen.
 */
export function ayoExecuteCode(code: string, params: unknown): string {
	const shownParams =
		params === undefined
			? "none"
			: JSON.stringify(params, null, 2).replace(
					/[^\n\x20-\x7E]/g,
					(character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
				);
	return `${shownParams}\n\n${code}`;
}

/**
 * The two parts of `ayoExecuteCode`'s text. Printed JSON has no empty line, so the first one is the
 * border, whatever the code contains. The chat shows the parts apart: neither can push the other out
 * of sight or pass for it.
 */
export function ayoExecuteParts(shown: string): { params: string; code: string } {
	const border = shown.indexOf("\n\n");
	if (border === -1) return { params: "", code: shown };
	return { params: shown.slice(0, border), code: shown.slice(border + 2) };
}

/**
 * The Ayo capabilities a piece of `ayo_execute` code names as `ayo.<name>(`, in order of first use.
 * A label for the history only: code can also reach a capability in ways this does not see.
 */
export function ayoCalls(code: string): string[] {
	return [...new Set([...code.matchAll(/\bayo\.([A-Za-z_]\w*)\s*\(/g)].map((match) => match[1]))];
}

/** What an `ayo_execute` call reports once Oladayo approved it; the chat then stops asking. */
export type AyoExecuteDetails = { approved: true };

/** URL path of the chat socket. The Worker forwards upgrades on it to the user's object. */
export const SOCKET_PATH = "agent-socket";

/** URL path Ayo's OAuth server sends the browser back to. The Worker forwards it to the user's object. */
export const AYO_CALLBACK_PATH = "ayo-callback";

/** The one agent object, for the single user. */
export const AGENT_NAME = "oladayo";

/** Client → server. */
export type ClientMessage =
	| { readonly type: "submit"; readonly text: string }
	| { readonly type: "abort" }
	/** The answer to an `ask` or `ayo_execute` tool call of the connection's session. */
	| { readonly type: "decide"; readonly callId: string; readonly answer: string };

/** Server → client. */
export type ServerMessage =
	/**
	 * Pi's own agent events for the connection's session. A `snapshot` event
	 * replaces the client's state: a watch starts with one, and Pi sends one
	 * again in place of batches it could not deliver.
	 */
	| { readonly type: "events"; readonly events: readonly AgentEvent[] }
	| { readonly type: "error"; readonly message: string };
