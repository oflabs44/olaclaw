import { type PiHarness, type PiSessionId, ROOT_SESSION } from "agents/harness/pi";
import { DEFAULT_MODEL, type ModelId } from "./models";

export type ChatSummary = { readonly id: string; readonly title: string; readonly model: ModelId };

const UNTITLED = "New chat";

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

	constructor(sql: SqlStorage, harness: PiHarness, nameChat: (firstMessage: string) => Promise<string>) {
		this.#sql = sql;
		this.#harness = harness;
		this.#nameChat = nameChat;
		sql.exec(
			"CREATE TABLE IF NOT EXISTS chat (session_id TEXT PRIMARY KEY, title TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
		);
		// The table was deployed without `model`. The chats from before run Kimi, so that is the column default.
		const hasModel = sql
			.exec<{ name: string }>("PRAGMA table_info(chat)")
			.toArray()
			.some((column) => column.name === "model");
		if (!hasModel) sql.exec("ALTER TABLE chat ADD COLUMN model TEXT NOT NULL DEFAULT 'kimi-k2.7'");
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
		return this.#sql
			.exec<{ session_id: string; title: string | null; model: ModelId }>(
				"SELECT session_id, title, model FROM chat ORDER BY updated_at DESC, created_at DESC",
			)
			.toArray()
			.map((row) => ({ id: row.session_id, title: row.title ?? UNTITLED, model: row.model }));
	}

	async create(): Promise<ChatSummary> {
		const session = await this.#harness.sessions.create();
		const now = Date.now();
		this.#sql.exec(
			"INSERT INTO chat (session_id, title, created_at, updated_at, model) VALUES (?, NULL, ?, ?, ?)",
			session.id,
			now,
			now,
			DEFAULT_MODEL,
		);
		return { id: session.id, title: UNTITLED, model: DEFAULT_MODEL };
	}

	setModel(session: PiSessionId, model: ModelId): void {
		this.#sql.exec("UPDATE chat SET model = ? WHERE session_id = ?", model, session);
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

	gaveUrl(session: PiSessionId, url: string): boolean {
		return this.#sql.exec("SELECT 1 FROM given_url WHERE session_id = ? AND url = ?", session, url).toArray().length > 0;
	}
}
