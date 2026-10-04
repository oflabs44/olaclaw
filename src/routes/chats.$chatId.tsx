import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { Composer } from "@/components/chat/composer";
import { Conversation } from "@/components/chat/conversation";
import { parentTitle } from "@/components/workspace/chat-tree";
import { PageHeader } from "@/components/workspace/page-header";
import { PiSessionProvider, usePiSession } from "@/pi-session";
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

function ChatPage() {
	const chatId = Route.useParams({ select: (params) => params.chatId });
	const forkEntryId = Route.useLoaderData({ select: (chat) => chat.forkEntryId });
	return (
		<PiSessionProvider key={chatId} chatId={chatId} forkEntryId={forkEntryId}>
			<ChatHeader />
			<Conversation />
			<Composer />
		</PiSessionProvider>
	);
}

function ChatHeader() {
	const chat = Route.useLoaderData();
	const parent = useLoaderData({ from: "__root__", select: (data) => parentTitle(chat, data.chats) });
	const isRunning = usePiSession((state) => state.running);
	return (
		<PageHeader
			title={chat.title}
			subtitle={
				chat.parentId !== null && (
					<>
						from{" "}
						<Link
							to="/chats/$chatId"
							params={{ chatId: chat.parentId }}
							search
							className="underline decoration-line-strong underline-offset-2 hover:text-ink"
						>
							{parent ?? "a chat"}
						</Link>
					</>
				)
			}
			status={isRunning && <WorkingIndicator />}
		/>
	);
}
