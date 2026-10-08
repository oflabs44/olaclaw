import { useLoaderData, useMatches, useParams } from "@tanstack/react-router";
import type { Desk } from "@/desks";
import { GENERAL_DESK_FOLDER, GENERAL_DESK_NAME } from "./general-desk";

/** The title of the chat the route shows, or undefined outside a chat. */
export function useOpenChatTitle(): string | undefined {
	const chatId = useParams({ strict: false, select: (params) => params.chatId });
	return useLoaderData({
		from: "__root__",
		select: (data) => data.chats.find((chat) => chat.id === chatId)?.title,
	});
}

/** The desk the route is in: one of the desk's pages, or a chat that belongs to it. Undefined at the General desk and on a page that belongs to no desk. */
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

/**
 * The nav group the route is in, which the nav opens: a desk's, or that of the General desk for its
 * page and for a chat at no desk.
 */
export function useActiveDeskFolder(): string | undefined {
	const desk = useActiveDesk();
	const chatId = useParams({ strict: false, select: (params) => params.chatId });
	const isAtGeneralPage = useMatches({ select: (matches) => matches.some((match) => match.routeId === "/chats/") });
	const isAtGeneralChat = useLoaderData({
		from: "__root__",
		select: (data) => data?.chats.find((chat) => chat.id === chatId)?.deskId === null,
	});
	if (desk) return desk.id;
	return isAtGeneralPage || isAtGeneralChat ? GENERAL_DESK_FOLDER : undefined;
}

/** Where the user is, for the omni trigger: "General / <chat title>", "<desk> / <page or chat>", or only the section. */
export function useCurrentPlace(): { section: string; view?: string } {
	// The deepest route that names a section: a tab of the Phoebe page takes the page's name.
	const section = useMatches({
		select: (matches) => matches.findLast((match) => match.staticData.section !== undefined)?.staticData.section,
	});
	const chatTitle = useOpenChatTitle();
	const desk = useActiveDesk();
	if (desk) return { section: desk.name, view: chatTitle ?? section };
	if (chatTitle !== undefined) return { section: GENERAL_DESK_NAME, view: chatTitle };
	return { section: section ?? "olaclaw" };
}
