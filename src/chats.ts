import { type PiHarness, type PiSessionId, ROOT_SESSION } from "agents/harness/pi";

export type ChatSummary = { readonly id: string; readonly title: string };

const UNTITLED = "New chat";

/** The first line of a trimmed, non-empty message, short enough for a list. */
function titleFromText(text: string): string {
	const line = text.split("\n")[0];
	return line.length > 60 ? `${line.slice(0, 59).trimEnd()}…` : line;
}

/**
 * The user's chats: the Pi sessions they started, with a title and an order. Pi's own session
 * list also holds the conversations subagent tools own, and has no titles or timestamps.
 */
export class Chats {
	readonly #sql: SqlStorage;
	readonly #harness: PiHarness;

	constructor(sql: SqlStorage, harness: PiHarness) {
		this.#sql = sql;
		this.#harness = harness;
		sql.exec(
			"CREATE TABLE IF NOT EXISTS chat (session_id TEXT PRIMARY KEY, title TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
		);
		// The root session was the only chat before this table existed, so its history stays reachable.
		// It keeps its old placeholder title: its first message is long gone.
		const now = Date.now();
		sql.exec(
			"INSERT INTO chat (session_id, title, created_at, updated_at) SELECT ?, 'Chat', ?, ? WHERE NOT EXISTS (SELECT 1 FROM chat)",
			ROOT_SESSION,
			now,
			now,
		);
	}

	/** Most recently used first. */
	list(): ChatSummary[] {
		return this.#sql
			.exec<{ session_id: string; title: string | null }>(
				"SELECT session_id, title FROM chat ORDER BY updated_at DESC, created_at DESC",
			)
			.toArray()
			.map((row) => ({ id: row.session_id, title: row.title ?? UNTITLED }));
	}

	async create(): Promise<ChatSummary> {
		const session = await this.#harness.sessions.create();
		const now = Date.now();
		this.#sql.exec(
			"INSERT INTO chat (session_id, title, created_at, updated_at) VALUES (?, NULL, ?, ?)",
			session.id,
			now,
			now,
		);
		return { id: session.id, title: UNTITLED };
	}

	has(session: PiSessionId): boolean {
		return this.#sql.exec("SELECT 1 FROM chat WHERE session_id = ?", session).toArray().length > 0;
	}

	/** Marks the chat as recently used, and names it from its first message. */
	recordSubmit(session: PiSessionId, text: string): void {
		this.#sql.exec(
			"UPDATE chat SET title = COALESCE(title, ?), updated_at = ? WHERE session_id = ?",
			titleFromText(text),
			Date.now(),
			session,
		);
	}
}
