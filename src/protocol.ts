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

/** URL path of the chat socket. The Worker forwards upgrades on it to the user's object. */
export const SOCKET_PATH = "agent-socket";

/** The one agent object, for the single user. */
export const AGENT_NAME = "oladayo";

/** Client → server. */
export type ClientMessage =
	| { readonly type: "submit"; readonly text: string }
	| { readonly type: "abort" }
	/** The answer to an `ask` tool call of the connection's session. */
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
