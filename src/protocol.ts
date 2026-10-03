// Adapted from Cloudflare's Pi harness example (MIT, Copyright (c) 2025 Cloudflare, Inc.).
import type { AgentEvent } from "@earendil-works/pi-durable";

/** URL path of the chat socket. The Worker forwards upgrades on it to the user's object. */
export const SOCKET_PATH = "agent-socket";

/** The one agent object, for the single user. */
export const AGENT_NAME = "oladayo";

/** Client → server. */
export type ClientMessage =
	| { readonly type: "submit"; readonly text: string }
	| { readonly type: "abort" };

/** Server → client. */
export type ServerMessage =
	/**
	 * Pi's own agent events for the connection's session. A `snapshot` event
	 * replaces the client's state: a watch starts with one, and Pi sends one
	 * again in place of batches it could not deliver.
	 */
	| { readonly type: "events"; readonly events: readonly AgentEvent[] }
	| { readonly type: "error"; readonly message: string };
