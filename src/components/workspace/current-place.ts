import { useLoaderData, useMatches, useParams } from "@tanstack/react-router";
import type { Desk } from "@/desks";

/** The title of the chat the route shows, or undefined outside a chat. */
export function useOpenChatTitle(): string | undefined {
	const chatId = useParams({ strict: false, select: (params) => params.chatId });
	return useLoaderData({
		from: "__root__",
		select: (data) => data.chats.find((chat) => chat.id === chatId)?.title,
	});
}

/**
 * The desk the route is in: one of the desk's pages, or a chat that belongs to it. The workspace then
 * takes the desk's colours and shows the desk's own navigation.
 */
export function useActiveDesk(): Desk | undefined {
	const deskId = useParams({ strict: false, select: (params) => params.deskId });
	const chatId = useParams({ strict: false, select: (params) => params.chatId });
	return useLoaderData({
		from: "__root__",
		// The data is missing when the root loader failed; the document shell still renders then.
		select: (data) => {
			const id = deskId ?? data?.chats.find((chat) => chat.id === chatId)?.deskId;
			return data?.desks.find((desk) => desk.id === id);
		},
	});
}

/** Where the user is, for the omni trigger: "Chats / <chat title>", "<desk> / <page or chat>", or only the section. */
export function useCurrentPlace(): { section: string; view?: string } {
	const section = useMatches({ select: (matches) => matches.at(-1)?.staticData.section });
	const chatTitle = useOpenChatTitle();
	const desk = useActiveDesk();
	if (desk) return { section: desk.name, view: chatTitle ?? section };
	if (chatTitle !== undefined) return { section: "Chats", view: chatTitle };
	return { section: section ?? "olaclaw" };
}
