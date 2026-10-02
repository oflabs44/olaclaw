import { createFileRoute } from "@tanstack/react-router";
import { useRootChatTitle } from "@/components/chat/chat-title";
import { Composer } from "@/components/chat/composer";
import { Conversation } from "@/components/chat/conversation";
import { PageHeader } from "@/components/workspace/page-header";
import { usePiSession } from "@/pi-session";
import { getChat } from "@/workspace-data";

export const Route = createFileRoute("/chats/$chatId")({
	staticData: { section: "Chats" },
	loader: ({ params }) => getChat({ data: { chatId: params.chatId } }),
	component: ChatPage,
});

function WorkingIndicator() {
	return (
		<span className="inline-flex items-center gap-2 text-[0.85rem] font-semibold text-primary max-wide:absolute max-wide:top-[calc(100%+2px)] max-wide:left-1/2 max-wide:-translate-x-1/2 max-wide:text-[11.5px]">
			<span className="size-[0.4rem] animate-stamp rounded-full bg-primary" aria-hidden="true" />
			Working
		</span>
	);
}

// Chat 1 is the root Pi session, the only one the socket follows so far.
function ChatPage() {
	const title = useRootChatTitle();
	const isRunning = usePiSession((state) => state.running);
	return (
		<>
			<PageHeader title={title} status={isRunning && <WorkingIndicator />} />
			<Conversation />
			<Composer />
		</>
	);
}
