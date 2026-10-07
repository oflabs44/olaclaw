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

/** The tool whose running call the chat renders as a new brief to approve. */
export const DESK_PROPOSE_BRIEF_TOOL = "desk_propose_brief";

/**
 * What Oladayo reads when Phoebe proposes a new brief for a desk. The tool and the chat both build it
 * from the call's arguments, so he approves the text that is saved. Only the first option changes the brief.
 */
export function deskBriefProposal(brief: string, reason: string) {
	return {
		question: "Replace this desk's brief?",
		// The reason stays on one line, so it cannot look like the brief that follows it.
		detail: `Why: ${reason.trim().replace(/\s+/g, " ")}\n\nThe new brief:\n${brief.trim()}`,
		options: ["Use the new brief", "Keep the current brief"],
	};
}

/**
 * The tools whose calls change what the workspace shows outside the transcript: the approvals, the
 * desks, and the chats with their desks. An open chat reloads the workspace when one starts or ends.
 */
export const WORKSPACE_TOOLS: ReadonlySet<string> = new Set([
	ASK_TOOL,
	DESK_PROPOSE_BRIEF_TOOL,
	"desk_create",
	"desk_update",
	"chat_move_to_desk",
	"chat_start",
	"desk_note",
	"desk_forget",
]);

/** The tool whose call the chat shows with its code as code. */
export const AYO_EXECUTE_TOOL = "ayo_execute";

/**
 * The two parts of a stored code approval: the printed params, an empty line, then the code. Printed
 * JSON has no empty line, so the first one is the border, whatever the code contains. The history
 * shows the parts apart.
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
	/** The answer to an `ask` or `desk_propose_brief` tool call of the connection's session. */
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
