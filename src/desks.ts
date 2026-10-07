import type { DeskHue, DeskIconName } from "./desk-look";

export type Desk = {
	readonly id: string;
	readonly name: string;
	/** The standing instructions for the desk: Oladayo wrote or approved them, or Phoebe wrote them when she created the desk. May be empty. */
	readonly brief: string;
	readonly hue: DeskHue;
	readonly icon: DeskIconName;
};

export type DeskInput = Omit<Desk, "id">;

export type DeskNote = {
	readonly id: number;
	readonly text: string;
	/** Epoch milliseconds. */
	readonly createdAt: number;
};

type DeskRow = { id: number; name: string; brief: string; hue: DeskHue; icon: DeskIconName };

function toDesk(row: DeskRow): Desk {
	return { id: String(row.id), name: row.name, brief: row.brief, hue: row.hue, icon: row.icon };
}

/**
 * Oladayo's desks: a standing job each, with a brief and a notebook that Phoebe keeps. He or Phoebe creates a desk; a brief changes only by his hand or approval.
 * The chats of a desk name it in `chat.desk_id`. A desk id is its row id as text; SQLite compares it
 * with the integer column as a number.
 */
export class Desks {
	readonly #sql: SqlStorage;

	constructor(sql: SqlStorage) {
		this.#sql = sql;
		sql.exec(
			"CREATE TABLE IF NOT EXISTS desk (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL CHECK(length(trim(name)) > 0), brief TEXT NOT NULL, hue TEXT NOT NULL, icon TEXT NOT NULL, created_at INTEGER NOT NULL)",
		);
		sql.exec(
			"CREATE TABLE IF NOT EXISTS desk_note (id INTEGER PRIMARY KEY AUTOINCREMENT, desk_id INTEGER NOT NULL, text TEXT NOT NULL CHECK(length(trim(text)) > 0), created_at INTEGER NOT NULL)",
		);
	}

	/** Oldest first, so a desk keeps its place in the list. */
	list(): Desk[] {
		return this.#sql
			.exec<DeskRow>("SELECT id, name, brief, hue, icon FROM desk ORDER BY created_at, id")
			.toArray()
			.map(toDesk);
	}

	find(id: string): Desk | undefined {
		const row = this.#sql.exec<DeskRow>("SELECT id, name, brief, hue, icon FROM desk WHERE id = ?", id).toArray()[0];
		return row && toDesk(row);
	}

	create(input: DeskInput): Desk {
		const row = this.#sql
			.exec<DeskRow>(
				"INSERT INTO desk (name, brief, hue, icon, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id, name, brief, hue, icon",
				input.name,
				input.brief,
				input.hue,
				input.icon,
				Date.now(),
			)
			.one();
		return toDesk(row);
	}

	/** False when no desk has this id. */
	update(id: string, input: DeskInput): boolean {
		const cursor = this.#sql.exec(
			"UPDATE desk SET name = ?, brief = ?, hue = ?, icon = ? WHERE id = ?",
			input.name,
			input.brief,
			input.hue,
			input.icon,
			id,
		);
		return cursor.rowsWritten > 0;
	}

	setBrief(id: string, brief: string): void {
		this.#sql.exec("UPDATE desk SET brief = ? WHERE id = ?", brief, id);
	}

	/** The desk's notebook, oldest first, so the prompt stays stable as notes are added. */
	notes(deskId: string): DeskNote[] {
		return this.#sql
			.exec<{ id: number; text: string; created_at: number }>(
				"SELECT id, text, created_at FROM desk_note WHERE desk_id = ? ORDER BY created_at, id",
				deskId,
			)
			.toArray()
			.map((row) => ({ id: row.id, text: row.text, createdAt: row.created_at }));
	}

	addNote(deskId: string, text: string): number {
		return this.#sql
			.exec<{ id: number }>(
				"INSERT INTO desk_note (desk_id, text, created_at) VALUES (?, ?, ?) RETURNING id",
				deskId,
				text,
				Date.now(),
			)
			.one().id;
	}

	/** False when the desk has no note with this id. A note of another desk stays. */
	removeNote(deskId: string, noteId: number): boolean {
		return this.#sql.exec("DELETE FROM desk_note WHERE id = ? AND desk_id = ?", noteId, deskId).rowsWritten > 0;
	}
}
