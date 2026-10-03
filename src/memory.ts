export type MemoryKind = "fact" | "note";

export type MemoryEntry = {
	readonly id: number;
	readonly kind: MemoryKind;
	readonly text: string;
	/** Epoch milliseconds. */
	readonly createdAt: number;
};

type MemoryRow = { id: number; kind: MemoryKind; text: string; created_at: number };

function toEntry(row: MemoryRow): MemoryEntry {
	return { id: row.id, kind: row.kind, text: row.text, createdAt: row.created_at };
}

/** `LIKE` treats `%` and `_` as wildcards; a word from the model must match literally. */
function likePattern(word: string): string {
	return `%${word.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

// The profile that lived in the system prompt before memory existed. Each line is seeded once,
// by its text; from then on Phoebe maintains it, and a forgotten seed stays forgotten.
const SEED_FACTS = [
	"Oladayo works at Axel Springer as a senior full-stack engineer.",
	"Oladayo's main stack is TypeScript, Svelte, React, Node.js, and Bun; secondary: Go, PHP, Laravel.",
	"Oladayo volunteers at GeTu Prospects e.V., a German association.",
	"Oladayo lives in Germany.",
	"Oladayo's family: Olawumi and Lois.",
	"Oladayo keeps passwords, secrets, and SSH keys in 1Password.",
];

/**
 * What Phoebe remembers. Facts are curated and go into every system prompt; notes are dated
 * working context found only through `recall`. Forgetting supersedes an entry and keeps the row.
 */
export class Memory {
	readonly #sql: SqlStorage;

	constructor(sql: SqlStorage) {
		this.#sql = sql;
		sql.exec(
			"CREATE TABLE IF NOT EXISTS memory (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL CHECK(kind IN ('fact','note')), text TEXT NOT NULL CHECK(length(trim(text)) > 0), created_at INTEGER NOT NULL, superseded_at INTEGER NULL)",
		);
		const now = Date.now();
		for (const text of SEED_FACTS) {
			sql.exec(
				"INSERT INTO memory (kind, text, created_at) SELECT 'fact', ?, ? WHERE NOT EXISTS (SELECT 1 FROM memory WHERE text = ?)",
				text,
				now,
				text,
			);
		}
	}

	/** Active facts, oldest first, so the prompt stays stable as facts are added. */
	facts(): { readonly id: number; readonly text: string }[] {
		return this.#sql
			.exec<{ id: number; text: string }>(
				"SELECT id, text FROM memory WHERE kind = 'fact' AND superseded_at IS NULL ORDER BY created_at, id",
			)
			.toArray();
	}

	/** Active facts and notes, newest first. */
	list(): MemoryEntry[] {
		return this.#sql
			.exec<MemoryRow>(
				"SELECT id, kind, text, created_at FROM memory WHERE superseded_at IS NULL ORDER BY created_at DESC, id DESC",
			)
			.toArray()
			.map(toEntry);
	}

	remember(kind: MemoryKind, text: string): number {
		return this.#sql
			.exec<{ id: number }>(
				"INSERT INTO memory (kind, text, created_at) VALUES (?, ?, ?) RETURNING id",
				kind,
				text,
				Date.now(),
			)
			.one().id;
	}

	/** False when no entry has this id. Forgetting twice is fine: a safe replay must not report failure. */
	forget(id: number): boolean {
		const cursor = this.#sql.exec(
			"UPDATE memory SET superseded_at = COALESCE(superseded_at, ?) WHERE id = ?",
			Date.now(),
			id,
		);
		return cursor.rowsWritten > 0;
	}

	/** Active entries that contain every word of `query` (case-folded for ASCII only), newest first. */
	recall(query: string, limit = 10): MemoryEntry[] {
		const words = query.split(/\s+/).filter((word) => word.length > 0);
		const conditions = words.map(() => " AND text LIKE ? ESCAPE '\\'").join("");
		return this.#sql
			.exec<MemoryRow>(
				`SELECT id, kind, text, created_at FROM memory WHERE superseded_at IS NULL${conditions} ORDER BY created_at DESC, id DESC LIMIT ?`,
				...words.map(likePattern),
				limit,
			)
			.toArray()
			.map(toEntry);
	}
}
