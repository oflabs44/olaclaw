import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { z } from "zod";

// Typed placeholders for the data the workspace shows. Each server function returns what exists
// today. Wiring a feature later changes the function body and, for the root loader, its staleTime.

export type ChatSummary = { readonly id: string; readonly title: string };

/** A decision the assistant waits for, shown in "Needs you" and in the chat that asked. */
export type Approval = { readonly id: string; readonly question: string; readonly detail?: string };

export type ScheduledItem = { readonly id: string; readonly title: string; readonly when: string };

export type NowPanel = {
	/** Background work. The live chat run comes from the socket, not from here. */
	readonly working: readonly { readonly id: string; readonly title: string; readonly detail: string }[];
	readonly needsYou: readonly Approval[];
	readonly comingUp: readonly ScheduledItem[];
	readonly doneToday: readonly ScheduledItem[];
};

export type Routine = { readonly id: string; readonly title: string; readonly schedule: string };

export type Memory = { readonly id: string; readonly text: string };

export type TodayItem = { readonly id: string; readonly title: string; readonly when: string };

/** The root Pi session is the only chat so far. */
const ROOT_CHAT: ChatSummary = { id: "1", title: "Chat" };

export const getChats = createServerFn().handler((): ChatSummary[] => [ROOT_CHAT]);

export const getChat = createServerFn()
	.validator(z.object({ chatId: z.string() }))
	.handler(({ data }): ChatSummary => {
		if (data.chatId !== ROOT_CHAT.id) throw notFound();
		return ROOT_CHAT;
	});

export const getNowPanel = createServerFn().handler(
	(): NowPanel => ({ working: [], needsYou: [], comingUp: [], doneToday: [] }),
);

export const getToday = createServerFn().handler((): TodayItem[] => []);

export const getRoutines = createServerFn().handler((): Routine[] => []);

export const getMemories = createServerFn().handler((): Memory[] => []);
