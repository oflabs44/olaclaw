// Adapted from Cloudflare's Pi harness example (MIT, Copyright (c) 2025 Cloudflare, Inc.).
import { useRouter } from "@tanstack/react-router";
import { createStore, useSelector } from "@tanstack/react-store";
import { useAgent } from "agents/react";
import { createContext, type ReactNode, use, useLayoutEffect, useMemo, useRef } from "react";
import { ASK_TOOL, type ClientMessage, type ServerMessage, SOCKET_PATH } from "./protocol";
import { EMPTY_VIEW, type PiSessionView, reduceEvents } from "./view";

export type ConnectionStatus = "connecting" | "open" | "closed";

export type PiSessionState = PiSessionView & {
	/** The chat the socket follows, or undefined when no chat is open. */
	readonly chatId: string | undefined;
	readonly status: ConnectionStatus;
	/**
	 * Texts this tab queued behind the running work, oldest first. Pi reports only how many
	 * items wait in its inbox (`queued`), so the texts are known only when the counts match.
	 */
	readonly queuedTexts: readonly string[];
};

const INITIAL_STATE: PiSessionState = {
	...EMPTY_VIEW,
	chatId: undefined,
	status: "connecting",
	queuedTexts: [],
};

// Only the browser writes to this store (the socket opens in an effect), so the module-level
// instance that SSR requests share always holds the initial state there.
export const piSessionStore = createStore<PiSessionState>(INITIAL_STATE);

// The provider mount that holds the store. Its socket's callbacks check it, so a late close from
// a previous mount, even of the same chat (back/forward), cannot touch the current one.
let storeOwner: object | undefined;

export function usePiSession<Selected>(selector: (state: PiSessionState) => Selected): Selected {
	return useSelector(piSessionStore, selector);
}

type PiCommands = {
	/** Idle: starts a run. Busy: Pi queues the text as a follow-up. False when the socket is not open. */
	readonly submit: (text: string) => boolean;
	readonly abort: () => boolean;
	/** Answers an `ask` tool call of this chat. */
	readonly decide: (callId: string, answer: string) => boolean;
};

const PiCommandsContext = createContext<PiCommands | null>(null);

export function usePiCommands(): PiCommands {
	const commands = use(PiCommandsContext);
	if (!commands) throw new Error("usePiCommands needs a PiSessionProvider");
	return commands;
}

/**
 * One chat's Pi session over the chat socket. The server sends Pi's own agent events and this
 * folds them into the store. A reconnect gets a fresh snapshot, so there is nothing to resume from.
 */
export function PiSessionProvider({
	chatId,
	forkEntryId,
	children,
}: {
	chatId: string;
	/** The last entry a branch shares with its parent; the messages after it are the branch's own. */
	forkEntryId: string | null;
	children: ReactNode;
}) {
	const router = useRouter();
	const owner = useRef({});

	// The store belongs to one chat at a time. A layout effect claims it before the first paint,
	// so the previous chat never shows. Router hooks cannot do this: they skip hydration, and
	// onStay also fires on search changes.
	useLayoutEffect(() => {
		storeOwner = owner.current;
		piSessionStore.setState(() => ({ ...INITIAL_STATE, chatId }));
		return () => {
			if (storeOwner !== owner.current) return;
			storeOwner = undefined;
			piSessionStore.setState(() => INITIAL_STATE);
		};
	}, [chatId]);

	function update(change: (current: PiSessionState) => PiSessionState) {
		if (storeOwner !== owner.current) return;
		piSessionStore.setState(change);
	}

	function setError(error: string) {
		update((current) => ({ ...current, error }));
	}

	// The socket opens in an effect, so it never connects during SSR. `basePath`
	// replaces the `/agents/:class/:name` URL: the server selects the object.
	const agent = useAgent({
		agent: "PiAgent",
		basePath: SOCKET_PATH,
		query: { session: chatId },
		onOpen: () => update((current) => ({ ...current, status: "open" })),
		onClose: () => update((current) => ({ ...current, status: "closed" })),
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
					const hasSnapshot = events.some((agentEvent) => agentEvent.type === "snapshot");
					const changesInbox =
						hasSnapshot || events.some((agentEvent) => agentEvent.type === "inbox_update");
					// A branch starts with its parent's messages, and its first own message names it.
					const ownMessages = () => {
						const all = piSessionStore.state.messages;
						return all.slice(all.findIndex((message) => message.id === forkEntryId) + 1);
					};
					const wasEmpty = ownMessages().length === 0;
					update((current) => {
						const next = { ...current, ...reduceEvents(current, events) };
						if (!changesInbox) return next;
						// Pi takes queued items from the front, so the oldest known texts go first.
						const texts = current.queuedTexts;
						return { ...next, queuedTexts: texts.slice(Math.max(0, texts.length - next.queued)) };
					});
					// The first message names the chat on the server, so the lists need the new title; by
					// the end of that first run the model-written title has usually replaced it.
					const messages = ownMessages();
					const isFirstRun = messages.filter((message) => message.role === "user").length === 1;
					const runEnded = events.some((agentEvent) => agentEvent.type === "run_end");
					// "Needs you" lists the open questions, so it reloads when `ask` starts and when it ends:
					// answered here, answered from the Now panel, or withdrawn by a Stop.
					const askChanged = events.some(
						(agentEvent) =>
							(agentEvent.type === "tool_execution_start" || agentEvent.type === "tool_execution_end") &&
							agentEvent.toolName === ASK_TOOL,
					);
					if (askChanged || (!hasSnapshot && isFirstRun && ((wasEmpty && messages.length > 0) || runEnded))) {
						void router.invalidate();
					}
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
			decide: (callId, answer) => send({ type: "decide", callId, answer }),
		};
	}, [agent]);

	return <PiCommandsContext value={commands}>{children}</PiCommandsContext>;
}
