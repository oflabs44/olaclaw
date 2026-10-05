import { exports } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { notFound } from "@tanstack/react-router";
import { z } from "zod";
import type { ChatSummary } from "./chats";
import type { MemoryEntry } from "./memory";
import { AGENT_NAME } from "./protocol";

// Chats, memories, and approvals come from the user's agent object. The other functions are typed placeholders that return
// what exists today; wiring a feature later changes the function body.

/** A decision the assistant asked for, shown in the approvals panel. It waits until `decision` is set. */
export type Approval = {
	/** The id of the `ask` or `ayo_execute` tool call that asked. */
	readonly id: string;
	readonly chatId: string;
	readonly question: string;
	readonly detail?: string;
	readonly options: readonly string[];
	/** Set when the answer decides on code, for example what an `ayo_execute` call wants to run. */
	readonly codeLineCount?: number;
	readonly decision?: string;
	readonly createdAt: number;
	readonly decidedAt?: number;
};

/** A decided approval in full. `code` is the text Oladayo read before he answered. */
export type DecidedApproval = Approval & {
	readonly code?: string;
	readonly decision: string;
	readonly decidedAt: number;
};

export type Routine = { readonly id: string; readonly title: string; readonly schedule: string };

export type TodayItem = { readonly id: string; readonly title: string; readonly when: string };

function userAgent() {
	return exports.PiAgent.getByName(AGENT_NAME);
}

export const getChats = createServerFn().handler((): Promise<ChatSummary[]> => userAgent().listChats());

export const getChat = createServerFn()
	.validator(z.object({ chatId: z.string() }))
	.handler(async ({ data }): Promise<ChatSummary> => {
		const chats = await userAgent().listChats();
		const chat = chats.find((candidate) => candidate.id === data.chatId);
		if (!chat) throw notFound();
		return chat;
	});

export const createChat = createServerFn({ method: "POST" }).handler(
	(): Promise<ChatSummary> => userAgent().createChat(),
);

export const forkChat = createServerFn({ method: "POST" })
	.validator(z.object({ chatId: z.string(), entryId: z.string() }))
	.handler(({ data }): Promise<ChatSummary> => userAgent().forkChat(data.chatId, data.entryId));

export const setChatModel = createServerFn({ method: "POST" })
	.validator(z.object({ chatId: z.string(), model: z.string() }))
	.handler(({ data }): Promise<void> => userAgent().setChatModel(data.chatId, data.model));

/** The waiting approvals first, then the decided ones, newest first. Without the code: see `getDecidedApproval`. */
export const getApprovals = createServerFn().handler(async (): Promise<Approval[]> => {
	const approvals = await userAgent().listApprovals();
	return approvals.map((approval) => ({
		id: approval.callId,
		chatId: approval.sessionId,
		question: approval.question,
		detail: approval.detail ?? undefined,
		options: approval.options,
		codeLineCount: approval.codeLineCount ?? undefined,
		decision: approval.decision ?? undefined,
		createdAt: approval.createdAt,
		decidedAt: approval.decidedAt ?? undefined,
	}));
});

/** Null for an approval that does not exist or still waits: a waiting one shows its code only in its chat. */
export const getDecidedApproval = createServerFn()
	.validator(z.object({ callId: z.string() }))
	.handler(async ({ data }): Promise<DecidedApproval | null> => {
		const approval = await userAgent().getApproval(data.callId);
		if (!approval || approval.decision === null || approval.decidedAt === null) return null;
		return {
			id: approval.callId,
			chatId: approval.sessionId,
			question: approval.question,
			detail: approval.detail ?? undefined,
			options: approval.options,
			code: approval.code ?? undefined,
			decision: approval.decision,
			createdAt: approval.createdAt,
			decidedAt: approval.decidedAt,
		};
	});

export const decideApproval = createServerFn({ method: "POST" })
	.validator(z.object({ callId: z.string(), answer: z.string() }))
	.handler(({ data }): Promise<void> => userAgent().decideApproval(data.callId, data.answer));

export const getAyoConnection = createServerFn().handler((): Promise<boolean> => userAgent().isAyoConnected());

/** The URL of Ayo's login page, or null when the stored token still connects. */
export const connectAyo = createServerFn({ method: "POST" }).handler(
	(): Promise<string | null> => userAgent().connectAyo(new URL(getRequest().url).origin),
);

export const getToday = createServerFn().handler((): TodayItem[] => []);

export const getRoutines = createServerFn().handler((): Routine[] => []);

export const getMemories = createServerFn().handler((): Promise<MemoryEntry[]> => userAgent().listMemories());
