import type { Conversation, EntryId, Extension, ModelRef } from "@earendil-works/pi-durable";
import { type PiHarness, type PiSessionId, ROOT_SESSION } from "agents/harness/pi";
import { DEFAULT_MODEL, type ModelId } from "./models";

export type ChatSummary = {
	readonly id: string;
	readonly title: string;
	readonly model: ModelId;
	/** The last use, in epoch milliseconds. */
	readonly updatedAt: number;
	/** The chat this one branched from, or null for a chat that started empty. */
	readonly parentId: string | null;
	/** The last Pi entry a branch shares with its parent. */
	readonly forkEntryId: string | null;
	/** The desk the chat belongs to, or null for a chat outside the desks. A branch stays at its parent's desk. */
	readonly deskId: string | null;
};

type ChatRow = {
	session_id: string;
	title: string | null;
	model: ModelId;
	updated_at: number;
	parent_session_id: string | null;
	fork_entry_id: string | null;
	desk_id: number | null;
};

const UNTITLED = "New chat";

// pi-durable takes a chord `Context` on every call, and `agents/harness/pi` keeps its own private.
// This is chord's background context: no values, never cancelled.
const BACKGROUND: Parameters<Conversation["fork"]>[2] = Object.freeze({
	abortSignal: undefined,
	value: () => undefined,
	toString: () => "[Context olaclaw]",
});

/** The first line of a trimmed, non-empty message, short enough for a list. */
function titleFromText(text: string): string {
	const line = text.split("\n")[0];
	return line.length > 60 ? `${line.slice(0, 59).trimEnd()}…` : line;
}

/** Normalised through `URL`, so the tool's argument compares equal when it names the same page. */
function urlsIn(text: string): string[] {
	const urls: string[] = [];
	for (const match of text.matchAll(/https?:\/\/[^\s<>"'`]+/g)) {
		// Trailing punctuation belongs to the sentence, not the URL.
		const raw = match[0].replace(/[.,;:!?)\]]+$/, "");
		try {
			urls.push(new URL(raw).href);
		} catch {
			// Not a URL after all; the model cannot fetch it either.
		}
	}
	return urls;
}

/**
 * The user's chats: the Pi sessions they started, with a title and an order. Pi's own session
 * list also holds the conversations subagent tools own, and has no titles or timestamps.
 */
export class Chats {
	readonly #sql: SqlStorage;
	readonly #harness: PiHarness;
	readonly #nameChat: (firstMessage: string) => Promise<string>;
	readonly #deskExtension: Extension;

	/** `deskExtension` is what the chats of a desk get on top of the other chats' extensions. */
	constructor(
		sql: SqlStorage,
		harness: PiHarness,
		nameChat: (firstMessage: string) => Promise<string>,
		deskExtension: Extension,
	) {
		this.#sql = sql;
		this.#harness = harness;
		this.#nameChat = nameChat;
		this.#deskExtension = deskExtension;
		sql.exec(
			"CREATE TABLE IF NOT EXISTS chat (session_id TEXT PRIMARY KEY, title TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
		);
		// The table was deployed without `model`. The chats from before run Kimi, so that is the column default.
		const columns = sql
			.exec<{ name: string }>("PRAGMA table_info(chat)")
			.toArray()
			.map((column) => column.name);
		if (!columns.includes("model")) sql.exec("ALTER TABLE chat ADD COLUMN model TEXT NOT NULL DEFAULT 'kimi-k2.7'");
		// A branch names its parent chat and the last entry it shares with it. Both are NULL for other chats.
		if (!columns.includes("parent_session_id")) {
			sql.exec("ALTER TABLE chat ADD COLUMN parent_session_id TEXT");
			sql.exec("ALTER TABLE chat ADD COLUMN fork_entry_id TEXT");
		}
		if (!columns.includes("desk_id")) sql.exec("ALTER TABLE chat ADD COLUMN desk_id INTEGER");
		// URLs Oladayo typed in a chat, plus the results of a web_search there: the only ones `fetch_url`
		// may fetch in that chat. A fetched page cannot name a URL to send data to; it can at most make the
		// model search, and the query text is guarded only by the prompt.
		sql.exec(
			"CREATE TABLE IF NOT EXISTS given_url (session_id TEXT NOT NULL, url TEXT NOT NULL, PRIMARY KEY (session_id, url))",
		);
		// The root session was the only chat before this table existed, so its history stays reachable.
		// It keeps its old placeholder title: its first message is long gone.
		const now = Date.now();
		sql.exec(
			"INSERT INTO chat (session_id, title, created_at, updated_at, model) SELECT ?, 'Chat', ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM chat)",
			ROOT_SESSION,
			now,
			now,
			DEFAULT_MODEL,
		);
	}

	/** Most recently used first. */
	list(): ChatSummary[] {
		const rows = this.#sql
			.exec<ChatRow>(
				"SELECT session_id, title, model, updated_at, parent_session_id, fork_entry_id, desk_id FROM chat ORDER BY updated_at DESC, created_at DESC",
			)
			.toArray();
		const rowsById = new Map(rows.map((row) => [row.session_id, row]));
		// A branch has no title of its own until its first message.
		function titleOf(row: ChatRow): string {
			if (row.title !== null) return row.title;
			const parent = row.parent_session_id === null ? undefined : rowsById.get(row.parent_session_id);
			return parent ? `Branch of ${titleOf(parent)}` : UNTITLED;
		}
		return rows.map((row) => ({
			id: row.session_id,
			title: titleOf(row),
			model: row.model,
			updatedAt: row.updated_at,
			parentId: row.parent_session_id,
			forkEntryId: row.fork_entry_id,
			deskId: row.desk_id === null ? null : String(row.desk_id),
		}));
	}

	/** A new, empty chat. With `deskId` it belongs to that desk, which the caller checked. */
	async create(deskId: string | null = null): Promise<ChatSummary> {
		const session = await this.#harness.sessions.create();
		if (deskId !== null) {
			const conversation = await this.#harness.conversation(session.id);
			await conversation.configure({ extensions: { add: [this.#deskExtension] } }, BACKGROUND);
		}
		const now = Date.now();
		this.#sql.exec(
			"INSERT INTO chat (session_id, title, created_at, updated_at, model, desk_id) VALUES (?, NULL, ?, ?, ?, ?)",
			session.id,
			now,
			now,
			DEFAULT_MODEL,
			deskId,
		);
		return {
			id: session.id,
			title: UNTITLED,
			model: DEFAULT_MODEL,
			updatedAt: now,
			parentId: null,
			forkEntryId: null,
			deskId,
		};
	}

	/**
	 * A new chat that shares the parent's transcript up to `entryId` and continues on its own, at the
	 * parent's desk: Pi copies the parent's extensions to a fork.
	 * It starts with no given URLs: `fetch_url` needs them typed or searched again in the branch.
	 */
	async fork(
		parentSession: PiSessionId,
		entryId: string,
		modelRef: (model: ModelId) => ModelRef,
	): Promise<ChatSummary> {
		const parent = this.list().find((chat) => chat.id === parentSession);
		if (!parent) throw new Error(`Unknown chat ${JSON.stringify(parentSession)}`);
		const at = Number(entryId);
		if (!Number.isSafeInteger(at) || at < 1) throw new Error(`Invalid entry ${JSON.stringify(entryId)}`);
		// `sessions.fork` forks only at the newest entry. Pi rejects an entry the parent cannot see. A fork
		// takes the model the parent had at that entry, so the chat's current model is set in the same commit.
		const conversation = await this.#harness.conversation(parentSession);
		const fork = await conversation.fork(
			at as EntryId,
			{ ownership: { kind: "ownerless" }, agent: { model: modelRef(parent.model) } },
			BACKGROUND,
		);
		const id = String(fork.id);
		const forkEntryId = String(at);
		const now = Date.now();
		this.#sql.exec(
			"INSERT INTO chat (session_id, title, created_at, updated_at, model, parent_session_id, fork_entry_id, desk_id) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)",
			id,
			now,
			now,
			parent.model,
			parentSession,
			forkEntryId,
			parent.deskId,
		);
		return {
			id,
			title: `Branch of ${parent.title}`,
			model: parent.model,
			updatedAt: now,
			parentId: parentSession,
			forkEntryId,
			deskId: parent.deskId,
		};
	}

	setModel(session: PiSessionId, model: ModelId): void {
		this.#sql.exec("UPDATE chat SET model = ? WHERE session_id = ?", model, session);
	}

	/** The desk of a chat. Null for a chat outside the desks and for a session that is no chat, such as a subagent's. */
	deskOf(session: PiSessionId): string | null {
		const row = this.#sql.exec<{ desk_id: number | null }>("SELECT desk_id FROM chat WHERE session_id = ?", session).toArray()[0];
		return row === undefined || row.desk_id === null ? null : String(row.desk_id);
	}

	has(session: PiSessionId): boolean {
		return this.#sql.exec("SELECT 1 FROM chat WHERE session_id = ?", session).toArray().length > 0;
	}

	/** Marks the chat as recently used, names it from its first message, and keeps the URLs it gives. */
	recordSubmit(session: PiSessionId, text: string): void {
		const provisionalTitle = titleFromText(text);
		const named = this.#sql.exec(
			"UPDATE chat SET title = COALESCE(title, ?), updated_at = ? WHERE session_id = ? RETURNING title",
			provisionalTitle,
			Date.now(),
			session,
		);
		// The first line stands in until a small model writes a real title. Replace only the stand-in,
		// so a title set in the meantime wins; the chat works the same if naming fails.
		if (named.one().title === provisionalTitle) {
			void this.#nameChat(text)
				.then((title) => {
					this.#sql.exec(
						"UPDATE chat SET title = ? WHERE session_id = ? AND title = ?",
						title,
						session,
						provisionalTitle,
					);
				})
				.catch((error) => console.error(`Cannot name chat ${session}`, error));
		}
		for (const url of urlsIn(text)) {
			this.#sql.exec("INSERT OR IGNORE INTO given_url (session_id, url) VALUES (?, ?)", session, url);
		}
	}

	/** Makes the results of a web search fetchable in the chat. Expects URLs normalised through `URL`. */
	recordFoundUrls(session: PiSessionId, urls: readonly string[]): void {
		for (const url of urls) {
			this.#sql.exec("INSERT OR IGNORE INTO given_url (session_id, url) VALUES (?, ?)", session, url);
		}
	}

	/** Makes the URLs that are fetchable in `fromSession` fetchable in `toSession` too. A repeat changes nothing. */
	inheritUrls(fromSession: PiSessionId, toSession: PiSessionId): void {
		this.#sql.exec(
			"INSERT OR IGNORE INTO given_url (session_id, url) SELECT ?, url FROM given_url WHERE session_id = ?",
			toSession,
			fromSession,
		);
	}

	gaveUrl(session: PiSessionId, url: string): boolean {
		return this.#sql.exec("SELECT 1 FROM given_url WHERE session_id = ? AND url = ?", session, url).toArray().length > 0;
	}
}
