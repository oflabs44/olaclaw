import { useLoaderData, useMatches, useParams } from "@tanstack/react-router";

/** The title of the chat the route shows, or undefined outside a chat. */
export function useOpenChatTitle(): string | undefined {
	const chatId = useParams({ strict: false, select: (params) => params.chatId });
	return useLoaderData({
		from: "__root__",
		select: (data) => data.chats.find((chat) => chat.id === chatId)?.title,
	});
}

/** Where the user is, for the omni trigger: "Chats / <chat title>", or only the section. */
export function useCurrentPlace(): { section: string; view?: string } {
	const section = useMatches({ select: (matches) => matches.at(-1)?.staticData.section });
	const chatTitle = useOpenChatTitle();
	if (chatTitle !== undefined) return { section: "Chats", view: chatTitle };
	return { section: section ?? "olaclaw" };
}
