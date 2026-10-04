// Adapted from Cloudflare's Pi harness example (MIT, Copyright (c) 2025 Cloudflare, Inc.).
import type { AgentEventStream } from "@earendil-works/pi-durable";
import { type PiHarness, type PiSessionId, ROOT_SESSION } from "agents/harness/pi";
import type { Connection } from "agents/lifecycle";
import type { WebSocketMessage, WebSocketsOptions } from "agents/websockets";
import type { Chats } from "./chats";
import type { ServerMessage } from "./protocol";

type ChatRegistry = Pick<Chats, "has" | "recordSubmit">;

const SESSION_TAG_PREFIX = "pi-session:";
// Marks a socket that follows a subagent's session: it gets the events and may send nothing.
const READ_ONLY_TAG = "read-only";
const SESSION_QUERY = "session";
const OPEN = WebSocket.OPEN;

function sessionTag(session: PiSessionId): string {
	return `${SESSION_TAG_PREFIX}${session}`;
}

function sessionFromRequest(request: Request): PiSessionId {
	const session = new URL(request.url).searchParams.get(SESSION_QUERY);
	if (session === null || session === "") return ROOT_SESSION;
	if (!/^[1-9][0-9]{0,15}$/.test(session)) {
		throw new Error(`Invalid pi session ${JSON.stringify(session)}`);
	}
	return session;
}

function sessionOf(tags: readonly string[]): PiSessionId | undefined {
	const tag = tags.find((candidate) => candidate.startsWith(SESSION_TAG_PREFIX));
	return tag?.slice(SESSION_TAG_PREFIX.length);
}

function send(socket: WebSocket, message: ServerMessage): void {
	if (socket.readyState !== OPEN) return;
	try {
		socket.send(JSON.stringify(message));
	} catch (error) {
		// A close between the state check and the send is expected; anything else is not.
		if (socket.readyState === OPEN) console.error(`Cannot send ${message.type} frame`, error);
	}
}

/**
 * Each socket follows one session, picked by `?session=`, through its own
 * `session.events()` stream: a `snapshot`, then one batch of Pi's agent
 * events per commit. Watches live in memory, so the host calls `reattach()`
 * from its `onStart` to give sockets that outlived the last isolate a new
 * watch and a fresh snapshot.
 */
export class PiSessionSockets {
	readonly #harness: PiHarness;
	readonly #getWebSockets: () => WebSocket[];
	readonly #getTags: (socket: WebSocket) => string[];
	readonly #chats: ChatRegistry;
	// Typed with the session required: a socket may decide only for its own chat.
	readonly #approvals: { decide(callId: string, answer: string, session: PiSessionId): void };
	readonly #watches = new Map<WebSocket, AgentEventStream>();

	constructor(
		harness: PiHarness,
		getWebSockets: () => WebSocket[],
		getTags: (socket: WebSocket) => string[],
		chats: ChatRegistry,
		approvals: { decide(callId: string, answer: string, session: PiSessionId): void },
	) {
		this.#harness = harness;
		this.#getWebSockets = getWebSockets;
		this.#getTags = getTags;
		this.#chats = chats;
		this.#approvals = approvals;
	}

	// Every Pi conversation that is not a chat belongs to a `delegate` call: Oladayo may watch it, not drive it.
	async #tagsFromRequest(request: Request): Promise<string[]> {
		const session = sessionFromRequest(request);
		if (this.#chats.has(session)) return [sessionTag(session)];
		const sessions = await this.#harness.sessions.list();
		if (!sessions.some((candidate) => candidate.id === session)) throw new Error(`Unknown session ${session}`);
		return [sessionTag(session), READ_ONLY_TAG];
	}

	options(): WebSocketsOptions {
		return {
			getConnectionTags: (_connection, ctx) => this.#tagsFromRequest(ctx.request),
			handlers: {
				onConnect: (connection, ctx) => this.#watch(connection, sessionFromRequest(ctx.request)),
				onMessage: (connection, message) => this.#onMessage(connection, message),
				onClose: (connection) => this.#unwatch(connection),
				onError: (connection) => this.#unwatch(connection),
			},
		};
	}

	/** Give every hibernated socket a new watch after the object restarts. */
	async reattach(): Promise<void> {
		for (const socket of this.#getWebSockets()) {
			// A failure here must not fail the object's startup. Closing the socket makes
			// the client reconnect, which reports the error through the connect path.
			try {
				const session = sessionOf(this.#getTags(socket));
				if (session === undefined) throw new Error("Socket has no session tag");
				await this.#watch(socket, session);
			} catch (error) {
				console.error("Cannot reattach socket", error);
				socket.close(1011, "Reattach failed");
			}
		}
	}

	async #watch(socket: WebSocket, session: PiSessionId): Promise<void> {
		await this.#unwatch(socket);
		const stream = await this.#harness.session(session).events();
		this.#watches.set(socket, stream);
		send(socket, { type: "events", events: [stream.snapshot] });
		stream.start(async (events) => {
			if (socket.readyState !== OPEN) {
				await this.#unwatch(socket);
				return;
			}
			send(socket, { type: "events", events });
		});
		// When Pi ends the watch itself, the socket would stay open with no events.
		// Closing it makes the client reconnect and take a fresh snapshot.
		void stream.closed.then((end) => {
			if (end.reason === "stopped" || this.#watches.get(socket) !== stream) return;
			console.error(`Session ${session} watch ended: ${end.reason}`);
			this.#watches.delete(socket);
			socket.close(1011, "Event stream ended");
		});
	}

	async #unwatch(socket: WebSocket): Promise<void> {
		const watch = this.#watches.get(socket);
		if (!watch) return;
		this.#watches.delete(socket);
		await watch.stop();
	}

	async #onMessage(connection: Connection, raw: WebSocketMessage): Promise<void> {
		if (typeof raw !== "string") return;
		try {
			const session = sessionOf(connection.tags);
			if (session === undefined) throw new Error("Connection has no session");
			if (connection.tags.includes(READ_ONLY_TAG)) throw new Error("This session is read-only");
			await this.#dispatch(session, JSON.parse(raw));
		} catch (error) {
			send(connection, {
				type: "error",
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	// The message is unvalidated socket input, so each field is checked before use.
	async #dispatch(
		session: PiSessionId,
		message: { type?: unknown; text?: unknown; callId?: unknown; answer?: unknown } | null,
	): Promise<void> {
		const handle = this.#harness.session(session);
		switch (message?.type) {
			case "submit": {
				if (typeof message.text !== "string" || message.text.trim() === "") {
					throw new Error("Prompt must be a non-empty string");
				}
				const text = message.text.trim();
				// Before the submit, so the chat has its title by the time its first events go out;
				// a failed submit still names the chat.
				this.#chats.recordSubmit(session, text);
				// Pi queues the input as a follow-up when the session is busy.
				await handle.submit(text);
				return;
			}
			case "abort":
				await handle.abort();
				return;
			case "decide":
				if (typeof message.callId !== "string" || typeof message.answer !== "string") {
					throw new Error("Decision needs a call id and an answer");
				}
				// A socket decides only for its own chat.
				this.#approvals.decide(message.callId, message.answer, session);
				return;
			default:
				throw new Error("Unknown message type");
		}
	}
}
