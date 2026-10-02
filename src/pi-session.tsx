// Adapted from Cloudflare's Pi harness example (MIT, Copyright (c) 2025 Cloudflare, Inc.).
import { createStore, useSelector } from "@tanstack/react-store";
import { useAgent } from "agents/react";
import { createContext, type ReactNode, use, useMemo } from "react";
import { type ClientMessage, type ServerMessage, SOCKET_PATH } from "./protocol";
import { EMPTY_VIEW, type PiSessionView, reduceEvents } from "./view";

export type ConnectionStatus = "connecting" | "open" | "closed";

export type PiSessionState = PiSessionView & {
	readonly status: ConnectionStatus;
	/**
	 * Texts this tab queued behind the running work, oldest first. Pi reports only how many
	 * items wait in its inbox (`queued`), so the texts are known only when the counts match.
	 */
	readonly queuedTexts: readonly string[];
};

const INITIAL_STATE: PiSessionState = { ...EMPTY_VIEW, status: "connecting", queuedTexts: [] };

// Only the browser writes to this store (the socket opens in an effect), so the module-level
// instance that SSR requests share always holds the initial state there.
export const piSessionStore = createStore<PiSessionState>(INITIAL_STATE);

export function usePiSession<Selected>(selector: (state: PiSessionState) => Selected): Selected {
	return useSelector(piSessionStore, selector);
}

type PiCommands = {
	/** Idle: starts a run. Busy: Pi queues the text as a follow-up. False when the socket is not open. */
	readonly submit: (text: string) => boolean;
	readonly abort: () => boolean;
};

const PiCommandsContext = createContext<PiCommands | null>(null);

export function usePiCommands(): PiCommands {
	const commands = use(PiCommandsContext);
	if (!commands) throw new Error("usePiCommands needs a PiSessionProvider");
	return commands;
}

function setError(error: string) {
	piSessionStore.setState((current) => ({ ...current, error }));
}

/**
 * The user's Pi session over the chat socket. The server sends Pi's own agent events and this
 * folds them into the store. A reconnect gets a fresh snapshot, so there is nothing to resume from.
 */
export function PiSessionProvider({ children }: { children: ReactNode }) {
	// The socket opens in an effect, so it never connects during SSR. `basePath`
	// replaces the `/agents/:class/:name` URL: the server selects the object.
	const agent = useAgent({
		agent: "PiAgent",
		basePath: SOCKET_PATH,
		onOpen: () => piSessionStore.setState((current) => ({ ...current, status: "open" })),
		onClose: () => piSessionStore.setState((current) => ({ ...current, status: "closed" })),
		onMessage: (event) => {
			let message: ServerMessage | { error: unknown } | null;
			try {
				message = JSON.parse(String(event.data));
			} catch {
				console.error("Pi socket: frame is not JSON", event.data);
				return;
			}
			if (typeof message !== "object" || message === null) return;
			// When socket setup fails in the object, the Agents SDK sends `{ error: stack }`
			// and closes. Without this the page would only show "Reconnecting…" for ever.
			if ("error" in message) {
				setError(String(message.error).split("\n")[0]);
				return;
			}
			switch (message.type) {
				case "events": {
					const events = message.events;
					const changesInbox = events.some(
						(agentEvent) => agentEvent.type === "inbox_update" || agentEvent.type === "snapshot",
					);
					piSessionStore.setState((current) => {
						const next = { ...current, ...reduceEvents(current, events) };
						if (!changesInbox) return next;
						// Pi takes queued items from the front, so the oldest known texts go first.
						const texts = current.queuedTexts;
						return { ...next, queuedTexts: texts.slice(Math.max(0, texts.length - next.queued)) };
					});
					return;
				}
				case "error":
					setError(message.message);
					return;
			}
		},
	});

	const commands = useMemo<PiCommands>(() => {
		function send(message: ClientMessage): boolean {
			if (agent.readyState !== WebSocket.OPEN) return false;
			agent.send(JSON.stringify(message));
			return true;
		}
		return {
			submit(text) {
				const isQueued = piSessionStore.state.running;
				if (!send({ type: "submit", text })) return false;
				if (isQueued) {
					piSessionStore.setState((current) => ({
						...current,
						queuedTexts: [...current.queuedTexts, text.trim()],
					}));
				}
				return true;
			},
			abort: () => send({ type: "abort" }),
		};
	}, [agent]);

	return <PiCommandsContext value={commands}>{children}</PiCommandsContext>;
}
