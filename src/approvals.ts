import type { Events } from "./events";

export type ApprovalRecord = {
	/** The id of the `ask` or `desk_propose_brief` tool call that waits for the decision. */
	readonly callId: string;
	readonly sessionId: string;
	readonly question: string;
	readonly detail: string | null;
	readonly options: readonly string[];
	readonly decision: string | null;
	readonly createdAt: number;
	readonly decidedAt: number | null;
};

type ApprovalRow = {
	call_id: string;
	session_id: string;
	question: string;
	detail: string | null;
	options: string;
	decision: string | null;
	created_at: number;
	decided_at: number | null;
};

const MAX_ANSWER_LENGTH = 500;

const COLUMNS = "call_id, session_id, question, detail, options, decision, created_at, decided_at";

function toRecord(row: ApprovalRow): ApprovalRecord {
	return {
		callId: row.call_id,
		sessionId: row.session_id,
		question: row.question,
		detail: row.detail,
		options: JSON.parse(row.options),
		decision: row.decision,
		createdAt: row.created_at,
		decidedAt: row.decided_at,
	};
}

/**
 * Questions Phoebe waits on. The row is the truth; the waiters are only this isolate's tool calls.
 * A restart drops the waiters, Pi reruns the waiting call, and the rerun reads the row again.
 */
export class Approvals {
	readonly #sql: SqlStorage;
	readonly #waiters = new Map<string, (decision: string) => void>();
	readonly #events: Events;

	constructor(sql: SqlStorage, events: Events) {
		this.#sql = sql;
		this.#events = events;
		sql.exec(
			"CREATE TABLE IF NOT EXISTS approval (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, call_id TEXT NOT NULL UNIQUE, question TEXT NOT NULL, detail TEXT NULL, options TEXT NOT NULL, decision TEXT NULL, created_at INTEGER NOT NULL, decided_at INTEGER NULL)",
		);
	}

	find(callId: string): ApprovalRecord | undefined {
		const row = this.#sql.exec<ApprovalRow>(`SELECT ${COLUMNS} FROM approval WHERE call_id = ?`, callId).toArray()[0];
		return row && toRecord(row);
	}

	/**
	 * Keeps the row a replayed call opened before, with its decision if one came in the meantime.
	 * Throws for a call id that already asked something else: an answer must never reach another question.
	 */
	open(session: string, callId: string, question: string, options: readonly string[], detail: string | undefined): void {
		const existing = this.find(callId);
		if (existing) {
			// Call ids come from the model provider. A repeat in another chat must not hand that chat's answer over.
			if (existing.sessionId !== session) throw new Error(`Call id ${callId} already asks in another chat`);
			if (existing.question !== question || JSON.stringify(existing.options) !== JSON.stringify(options)) {
				throw new Error(`Call id ${callId} already asked a different question`);
			}
			// The question of a proposed brief is fixed, so the detail, which holds the brief, is what tells two calls apart.
			if (existing.detail !== (detail ?? null)) throw new Error(`Call id ${callId} already asked with another detail`);
			return;
		}
		this.#sql.exec(
			"INSERT INTO approval (session_id, call_id, question, detail, options, created_at) VALUES (?, ?, ?, ?, ?, ?)",
			session,
			callId,
			question,
			detail ?? null,
			JSON.stringify(options),
			Date.now(),
		);
	}

	/**
	 * The first answer stands; a second one, for example from another tab, changes nothing. An answer
	 * is one of the options or free text. `session` limits the decision to approvals of that chat.
	 */
	decide(callId: string, answer: string, session?: string): void {
		const approval = this.find(callId);
		if (!approval || (session !== undefined && approval.sessionId !== session)) {
			throw new Error("Unknown approval");
		}
		const text = answer.trim();
		if (text.length === 0 || text.length > MAX_ANSWER_LENGTH) throw new Error("An answer is 1 to 500 characters");
		if (approval.decision !== null) return;
		this.#sql.exec("UPDATE approval SET decision = ?, decided_at = ? WHERE call_id = ?", text, Date.now(), callId);
		this.#events.record("approval_decided", { sessionId: approval.sessionId, text, callId });
		this.#waiters.get(callId)?.(text);
	}

	/** The undecided ones first, then the decided ones; newest first in each group. */
	list(limit: number): ApprovalRecord[] {
		return this.#sql
			.exec<ApprovalRow>(
				`SELECT ${COLUMNS} FROM approval ORDER BY decision IS NOT NULL, created_at DESC, id DESC LIMIT ?`,
				limit,
			)
			.toArray()
			.map(toRecord);
	}

	/**
	 * The decision for an open approval. An abort while this call waits withdraws the question; an abort
	 * that lands when no call waits (after a restart, before the rerun) leaves the row for the rerun.
	 */
	wait(callId: string, signal: AbortSignal | undefined): Promise<string> {
		const approval = this.find(callId);
		if (!approval) throw new Error("Unknown approval");
		if (approval.decision !== null) return Promise.resolve(approval.decision);

		return new Promise((resolve, reject) => {
			const withdraw = () => {
				this.#waiters.delete(callId);
				this.#sql.exec("DELETE FROM approval WHERE call_id = ? AND decision IS NULL", callId);
				reject(signal?.reason);
			};
			if (signal?.aborted) {
				withdraw();
				return;
			}
			signal?.addEventListener("abort", withdraw, { once: true });
			this.#waiters.set(callId, (decision) => {
				this.#waiters.delete(callId);
				signal?.removeEventListener("abort", withdraw);
				resolve(decision);
			});
		});
	}
}
