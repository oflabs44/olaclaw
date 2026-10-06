// Adapted from Cloudflare's Pi harness example (MIT, Copyright (c) 2025 Cloudflare, Inc.).
import { useRouter } from "@tanstack/react-router";
import { createStore, useSelector } from "@tanstack/react-store";
import { useAgent } from "agents/react";
import type { AgentEvent } from "@earendil-works/pi-durable";
import { createContext, type ReactNode, use, useLayoutEffect, useMemo, useRef, useState } from "react";
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

function createPiSessionStore() {
	return createStore<PiSessionState>(INITIAL_STATE);
}

// The open chat's store. Only the browser writes to it (the socket opens in an effect), so the
// module-level instance that SSR requests share always holds the initial state there.
export const piSessionStore = createPiSessionStore();

// The chat's store, or a subagent's store below a SubagentSessionProvider.
const PiSessionStoreContext = createContext(piSessionStore);

// The provider mount that holds the store. Its socket's callbacks check it, so a late close from
// a previous mount, even of the same chat (back/forward), cannot touch the current one.
let storeOwner: object | undefined;

export function usePiSession<Selected>(selector: (state: PiSessionState) => Selected): Selected {
	return useSelector(use(PiSessionStoreContext), selector);
}

type PiCommands = {
	/** Idle: starts a run. Busy: Pi queues the text as a follow-up. False when the socket is not open. */
	readonly submit: (text: string) => boolean;
	readonly abort: () => boolean;
	/** Answers an `ask` or `ayo_execute` tool call of this chat. */
	readonly decide: (callId: string, answer: string) => boolean;
};

const PiCommandsContext = createContext<PiCommands | null>(null);

export function usePiCommands(): PiCommands {
	const commands = use(PiCommandsContext);
	if (!commands) throw new Error("usePiCommands needs a PiSessionProvider");
	return commands;
}

type UpdateState = (change: (current: PiSessionState) => PiSessionState) => void;

/**
 * The socket of one Pi session: a chat, or a subagent's conversation. It keeps the connection
 * status and the error in the session's store; `onEvents` folds Pi's agent events into it.
 */
function usePiSessionSocket(session: string, update: UpdateState, onEvents: (events: readonly AgentEvent[]) => void) {
	function setError(error: string) {
		update((current) => ({ ...current, error }));
	}

	// The socket opens in an effect, so it never connects during SSR. `basePath`
	// replaces the `/agents/:class/:name` URL: the server selects the object.
	return useAgent({
		agent: "PiAgent",
		basePath: SOCKET_PATH,
		query: { session },
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
				case "events":
					onEvents(message.events);
					return;
				case "error":
					setError(message.message);
					return;
			}
		},
	});
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

	const agent = usePiSessionSocket(chatId, update, (events) => {
		const hasSnapshot = events.some((agentEvent) => agentEvent.type === "snapshot");
		const changesInbox = hasSnapshot || events.some((agentEvent) => agentEvent.type === "inbox_update");
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
		// The approvals panel lists the questions, so it reloads when `ask` starts and when it ends:
		// answered here, answered from the panel, or withdrawn by a Stop.
		const askChanged = events.some(
			(agentEvent) =>
				(agentEvent.type === "tool_execution_start" || agentEvent.type === "tool_execution_end") &&
				agentEvent.toolName === ASK_TOOL,
		);
		if (askChanged || (!hasSnapshot && isFirstRun && ((wasEmpty && messages.length > 0) || runEnded))) {
			void router.invalidate();
		}
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

type PiSessionStore = ReturnType<typeof createPiSessionStore>;

// Its own component, so the socket exists only while it is mounted.
function SubagentSocket({ conversationId, store }: { conversationId: string; store: PiSessionStore }) {
	usePiSessionSocket(
		conversationId,
		(change) => store.setState(change),
		(events) => store.setState((current) => ({ ...current, ...reduceEvents(current, events) })),
	);
	return null;
}

/**
 * A subagent's Pi session in a store of its own: below it `usePiSession` reads the subagent, not
 * the chat. The socket is read-only and is open only while `isWatching`; the store keeps what it
 * last received.
 */
export function SubagentSessionProvider({
	conversationId,
	isWatching,
	children,
}: {
	/** Undefined until the `delegate` call reports the conversation it made, and again when the call stopped without a result. */
	conversationId: string | undefined;
	isWatching: boolean;
	children: ReactNode;
}) {
	const [store] = useState(createPiSessionStore);
	return (
		<PiSessionStoreContext value={store}>
			{isWatching && conversationId !== undefined && <SubagentSocket conversationId={conversationId} store={store} />}
			{children}
		</PiSessionStoreContext>
	);
}
