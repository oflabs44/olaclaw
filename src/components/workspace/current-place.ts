import { useMatches } from "@tanstack/react-router";
import { useRootChatTitle } from "@/components/chat/chat-title";

/** Where the user is, for the omni trigger: "Chats / <chat title>", or only the section. */
export function useCurrentPlace(): { section: string; view?: string } {
	const routeId = useMatches({ select: (matches) => matches.at(-1)?.routeId });
	const section = useMatches({ select: (matches) => matches.at(-1)?.staticData.section });
	const chatTitle = useRootChatTitle();
	if (routeId === "/chats/$chatId") return { section: "Chats", view: chatTitle };
	return { section: section ?? "olaclaw" };
}
