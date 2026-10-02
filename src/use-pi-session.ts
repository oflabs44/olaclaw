// Adapted from Cloudflare's Pi harness example (MIT, Copyright (c) 2025 Cloudflare, Inc.).
import { useAgent } from "agents/react";
import { useCallback, useState } from "react";
import { type ClientMessage, type ServerMessage, SOCKET_PATH } from "./protocol";
import { EMPTY_VIEW, type PiSessionView, reduceEvents } from "./view";

export type ConnectionStatus = "connecting" | "open" | "closed";

type State = PiSessionView & { readonly status: ConnectionStatus };

const INITIAL_STATE: State = { ...EMPTY_VIEW, status: "connecting" };

/**
 * The user's Pi session over the chat socket. The server sends Pi's own agent
 * events and this folds them into the view. A reconnect gets a fresh snapshot,
 * so there is nothing to resume from.
 */
export function usePiSession() {
	const [state, setState] = useState<State>(INITIAL_STATE);

	// The socket opens in an effect, so it never connects during SSR. `basePath`
	// replaces the `/agents/:class/:name` URL: the server selects the object.
	const agent = useAgent({
		agent: "PiAgent",
		basePath: SOCKET_PATH,
		onOpen: () => setState((current) => ({ ...current, status: "open" })),
		onClose: () => setState((current) => ({ ...current, status: "closed" })),
		onMessage: (event) => {
			let message: ServerMessage | { error: unknown } | null;
			try {
				message = JSON.parse(String(event.data));
			} catch {
				return;
			}
			if (typeof message !== "object" || message === null) return;
			// When socket setup fails in the object, the Agents SDK sends `{ error: stack }`
			// and closes. Without this the page would only show "Reconnecting…" for ever.
			if ("error" in message) {
				const error = String(message.error).split("\n")[0];
				setState((current) => ({ ...current, error }));
				return;
			}
			switch (message.type) {
				case "events": {
					const events = message.events;
					setState((current) => ({ ...current, ...reduceEvents(current, events) }));
					return;
				}
				case "error": {
					const error = message.message;
					setState((current) => ({ ...current, error }));
					return;
				}
			}
		},
	});

	const send = useCallback(
		(message: ClientMessage): boolean => {
			if (agent.readyState !== WebSocket.OPEN) return false;
			agent.send(JSON.stringify(message));
			return true;
		},
		[agent],
	);

	/** Idle: starts a run. Busy: Pi queues the text as a follow-up. */
	const submit = useCallback((text: string) => send({ type: "submit", text }), [send]);
	const abort = useCallback(() => send({ type: "abort" }), [send]);

	return { ...state, submit, abort };
}
