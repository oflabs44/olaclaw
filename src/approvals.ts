export type ApprovalRecord = {
	/** The id of the `ask` tool call that waits for the decision. */
	readonly callId: string;
	readonly sessionId: string;
	readonly question: string;
	readonly detail: string | null;
	readonly options: readonly string[];
	readonly decision: string | null;
};

type ApprovalRow = {
	call_id: string;
	session_id: string;
	question: string;
	detail: string | null;
	options: string;
	decision: string | null;
};

const COLUMNS = "call_id, session_id, question, detail, options, decision";

function toRecord(row: ApprovalRow): ApprovalRecord {
	return {
		callId: row.call_id,
		sessionId: row.session_id,
		question: row.question,
		detail: row.detail,
		options: JSON.parse(row.options),
		decision: row.decision,
	};
}

/**
 * Questions Phoebe waits on. The row is the truth; the waiters are only this isolate's tool calls.
 * A restart drops the waiters, Pi reruns the `ask` call, and the rerun reads the row again.
 */
export class Approvals {
	readonly #sql: SqlStorage;
	readonly #waiters = new Map<string, (decision: string) => void>();

	constructor(sql: SqlStorage) {
		this.#sql = sql;
		sql.exec(
			"CREATE TABLE IF NOT EXISTS approval (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, call_id TEXT NOT NULL UNIQUE, question TEXT NOT NULL, detail TEXT NULL, options TEXT NOT NULL, decision TEXT NULL, created_at INTEGER NOT NULL, decided_at INTEGER NULL)",
		);
	}

	#find(callId: string): ApprovalRecord | undefined {
		const row = this.#sql.exec<ApprovalRow>(`SELECT ${COLUMNS} FROM approval WHERE call_id = ?`, callId).toArray()[0];
		return row && toRecord(row);
	}

	/**
	 * Keeps the row a replayed call opened before, with its decision if one came in the meantime.
	 * Throws for a call id that already asked something else: an answer must never reach another question.
	 */
	open(
		session: string,
		callId: string,
		question: string,
		options: readonly string[],
		detail: string | undefined,
	): void {
		const existing = this.#find(callId);
		if (existing) {
			// Call ids come from the model provider. A repeat in another chat must not hand that chat's answer over.
			if (existing.sessionId !== session) throw new Error(`Call id ${callId} already asks in another chat`);
			if (existing.question !== question || JSON.stringify(existing.options) !== JSON.stringify(options)) {
				throw new Error(`Call id ${callId} already asked a different question`);
			}
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
	 * The first decision stands; a second one, for example from another tab, changes nothing.
	 * `session` limits the decision to approvals of that chat.
	 */
	decide(callId: string, option: string, session?: string): void {
		const approval = this.#find(callId);
		if (!approval || (session !== undefined && approval.sessionId !== session)) {
			throw new Error("Unknown approval");
		}
		if (!approval.options.includes(option)) throw new Error(`Not an option: ${JSON.stringify(option)}`);
		if (approval.decision !== null) return;
		this.#sql.exec("UPDATE approval SET decision = ?, decided_at = ? WHERE call_id = ?", option, Date.now(), callId);
		this.#waiters.get(callId)?.(option);
	}

	/** Undecided, oldest first. */
	pending(): ApprovalRecord[] {
		return this.#sql
			.exec<ApprovalRow>(`SELECT ${COLUMNS} FROM approval WHERE decision IS NULL ORDER BY created_at, id`)
			.toArray()
			.map(toRecord);
	}

	/**
	 * The decision for an open approval. An abort while this call waits withdraws the question; an abort
	 * that lands when no call waits (after a restart, before the rerun) leaves the row for the rerun.
	 */
	wait(callId: string, signal: AbortSignal | undefined): Promise<string> {
		const approval = this.#find(callId);
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
