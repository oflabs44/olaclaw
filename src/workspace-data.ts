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

/** A decision the assistant waits for, shown in "Needs you" and in the chat that asked. */
export type Approval = {
	/** The id of the `ask` or `ayo_execute` tool call that waits. */
	readonly id: string;
	readonly chatId: string;
	readonly question: string;
	readonly detail?: string;
	/** Code the answer decides on, for example what an `ayo_execute` call wants to run. */
	readonly code?: string;
	readonly options: readonly string[];
};

export type ScheduledItem = { readonly id: string; readonly title: string; readonly when: string };

export type NowPanel = {
	/** Background work. The live chat run comes from the socket, not from here. */
	readonly working: readonly { readonly id: string; readonly title: string; readonly detail: string }[];
	readonly needsYou: readonly Approval[];
	readonly comingUp: readonly ScheduledItem[];
	readonly doneToday: readonly ScheduledItem[];
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

export const getNowPanel = createServerFn().handler(async (): Promise<NowPanel> => {
	const pending = await userAgent().listApprovals();
	const needsYou = pending.map((approval) => ({
		id: approval.callId,
		chatId: approval.sessionId,
		question: approval.question,
		detail: approval.detail ?? undefined,
		code: approval.code ?? undefined,
		options: approval.options,
	}));
	return { working: [], needsYou, comingUp: [], doneToday: [] };
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
