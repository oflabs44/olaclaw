import { exports } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { z } from "zod";
import type { ChatSummary } from "./chats";
import { AGENT_NAME } from "./protocol";

// Chats come from the user's agent object. The other functions are typed placeholders that return
// what exists today; wiring a feature later changes the function body.

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

export const getNowPanel = createServerFn().handler(
	(): NowPanel => ({ working: [], needsYou: [], comingUp: [], doneToday: [] }),
);

export const getToday = createServerFn().handler((): TodayItem[] => []);

export const getRoutines = createServerFn().handler((): Routine[] => []);

export const getMemories = createServerFn().handler((): Memory[] => []);
