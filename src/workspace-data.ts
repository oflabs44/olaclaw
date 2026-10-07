import { exports } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { notFound } from "@tanstack/react-router";
import { z } from "zod";
import type { TodayEvent } from "./agent";
import type { ChatSummary } from "./chats";
import { DESK_HUES, DESK_ICONS, MAX_DESK_BRIEF_LENGTH, MAX_DESK_NAME_LENGTH } from "./desk-look";
import type { Desk, DeskNote } from "./desks";
import type { MemoryEntry } from "./memory";
import { AGENT_NAME } from "./protocol";

// Everything here comes from the user's agent object.

/** A decision the assistant asked for, shown in the approvals panel. It waits until `decision` is set. */
export type Approval = {
	/** The id of the `ask` or `desk_propose_brief` tool call that asked. */
	readonly id: string;
	readonly chatId: string;
	readonly question: string;
	readonly detail?: string;
	readonly options: readonly string[];
	/** Set when the answer decides on code, for example what an `ayo_execute` call wants to run. */
	readonly codeLineCount?: number;
	/** The Ayo capabilities that code names, as a label for the history. */
	readonly codeCalls?: readonly string[];
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

// A desk id is a row id. Other spellings of the same number, such as "1.0", must not reach SQLite, which would take them.
const deskId = z.string().regex(/^[1-9][0-9]{0,15}$/);

const deskInput = z.object({
	name: z.string().trim().min(1).max(MAX_DESK_NAME_LENGTH),
	brief: z.string().trim().max(MAX_DESK_BRIEF_LENGTH),
	hue: z.enum(DESK_HUES),
	icon: z.enum(DESK_ICONS),
});

export const getDesks = createServerFn().handler((): Promise<Desk[]> => userAgent().listDesks());

export const createDesk = createServerFn({ method: "POST" })
	.validator(deskInput)
	.handler(({ data }): Promise<Desk> => userAgent().createDesk(data));

export const updateDesk = createServerFn({ method: "POST" })
	.validator(deskInput.extend({ deskId }))
	.handler(async ({ data: { deskId, ...input } }): Promise<void> => {
		if (!(await userAgent().updateDesk(deskId, input))) throw notFound();
	});

/** A brief that Phoebe writes from the desk's name and a rough description of the job. It is not saved. */
export const draftDeskBrief = createServerFn({ method: "POST" })
	.validator(deskInput.pick({ name: true }).extend({ description: z.string().trim().min(1).max(MAX_DESK_BRIEF_LENGTH) }))
	.handler(({ data }): Promise<string> => userAgent().draftDeskBrief(data.name, data.description));

/** A desk with its notebook, oldest note first. */
export const getDesk = createServerFn()
	// The id comes from the URL, so one of the wrong form is a page that does not exist, not a failed load.
	.validator(z.object({ deskId: z.string() }))
	.handler(async ({ data }): Promise<{ desk: Desk; notes: DeskNote[] }> => {
		if (!deskId.safeParse(data.deskId).success) throw notFound();
		const desk = await userAgent().getDesk(data.deskId);
		if (!desk) throw notFound();
		return desk;
	});

export const removeDeskNote = createServerFn({ method: "POST" })
	.validator(z.object({ deskId, noteId: z.number().int() }))
	.handler(({ data }): Promise<void> => userAgent().removeDeskNote(data.deskId, data.noteId));

/** A new chat at the desk, already running on `text`. */
export const startDeskChat = createServerFn({ method: "POST" })
	.validator(z.object({ deskId, text: z.string().trim().min(1) }))
	.handler(({ data }): Promise<ChatSummary> => userAgent().startDeskChat(data.deskId, data.text));

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
		codeCalls: approval.codeCalls,
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

/** What happened in the last 7 days, newest first, and every question that still waits. */
export const getToday = createServerFn().handler((): Promise<TodayEvent[]> => userAgent().listToday());

export const getMemories = createServerFn().handler((): Promise<MemoryEntry[]> => userAgent().listMemories());
