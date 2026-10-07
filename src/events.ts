/** `approval_opened` is never stored: a question that waits is read from the approval table and shown as this kind. */
export type EventKind =
	| "desk_created"
	| "brief_changed"
	| "note_added"
	| "chat_started"
	| "approval_opened"
	| "approval_decided";

export type EventRecord = {
	readonly id: number;
	/** Epoch milliseconds. */
	readonly at: number;
	readonly kind: EventKind;
	readonly deskId: string | null;
	readonly sessionId: string | null;
	/** What the kind is about: the desk's name, the note, the chat's first line, the question, or the answer. */
	readonly text: string;
	/** The tool call of an approval. */
	readonly callId: string | null;
};

type EventRow = {
	id: number;
	at: number;
	kind: EventKind;
	desk_id: number | null;
	session_id: string | null;
	text: string;
	call_id: string | null;
};

const MAX_EVENTS = 500;

/**
 * What happened in the workspace, for the Today page: one row per change to a desk, new chat, and
 * approval. Not the messages of a chat; the transcript has them. Only the newest rows stay.
 */
export class Events {
	readonly #sql: SqlStorage;

	constructor(sql: SqlStorage) {
		this.#sql = sql;
		sql.exec(
			"CREATE TABLE IF NOT EXISTS event (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, kind TEXT NOT NULL, desk_id INTEGER NULL, session_id TEXT NULL, text TEXT NOT NULL, call_id TEXT NULL)",
		);
	}

	/** The log is secondary: a write that fails is logged and does not fail the change it records. */
	record(
		kind: EventKind,
		about: { deskId?: string | null; sessionId?: string; text: string; callId?: string },
	): void {
		try {
			const { id } = this.#sql
				.exec<{ id: number }>(
					"INSERT INTO event (at, kind, desk_id, session_id, text, call_id) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
					Date.now(),
					kind,
					about.deskId ?? null,
					about.sessionId ?? null,
					about.text,
					about.callId ?? null,
				)
				.one();
			// Ids only grow, so this keeps the newest rows.
			this.#sql.exec("DELETE FROM event WHERE id <= ?", id - MAX_EVENTS);
		} catch (error) {
			console.error(`Cannot record ${kind} event`, error);
		}
	}

	/** Newest first. */
	list(): EventRecord[] {
		return this.#sql
			.exec<EventRow>("SELECT id, at, kind, desk_id, session_id, text, call_id FROM event ORDER BY id DESC")
			.toArray()
			.map((row) => ({
				id: row.id,
				at: row.at,
				kind: row.kind,
				deskId: row.desk_id === null ? null : String(row.desk_id),
				sessionId: row.session_id,
				text: row.text,
				callId: row.call_id,
			}));
	}
}
