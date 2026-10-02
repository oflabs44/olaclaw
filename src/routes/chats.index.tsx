import { BubbleChatIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { ROOT_CHAT_ID, useRootChatTitle } from "@/components/chat/chat-title";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/workspace/page-header";

export const Route = createFileRoute("/chats/")({
	staticData: { section: "Chats" },
	component: ChatsPage,
});

function ChatsPage() {
	const chats = useLoaderData({ from: "__root__", select: (data) => data.chats });
	const rootChatTitle = useRootChatTitle();
	return (
		<>
			<PageHeader title="Chats" />
			<Empty>
				<EmptyHeader>
					<EmptyMedia>
						<HugeiconsIcon icon={BubbleChatIcon} strokeWidth={1.5} />
					</EmptyMedia>
					<EmptyTitle>Pick a chat</EmptyTitle>
					<EmptyDescription>There is one chat so far. New chats show here when you start them.</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					{chats.map((chat) => (
						<Link
							key={chat.id}
							to="/chats/$chatId"
							params={{ chatId: chat.id }}
							className="chip-quiet inline-flex h-8 max-w-full items-center rounded-full px-3.5 text-[13.5px] font-medium touch:h-10"
						>
							<span className="truncate">{chat.id === ROOT_CHAT_ID ? rootChatTitle : chat.title}</span>
						</Link>
					))}
				</EmptyContent>
			</Empty>
		</>
	);
}
