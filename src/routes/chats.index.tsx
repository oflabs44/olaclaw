import { BubbleChatIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/workspace/page-header";

export const Route = createFileRoute("/chats/")({
	staticData: { section: "Chats" },
	component: ChatsPage,
});

function ChatsPage() {
	const chats = useLoaderData({ from: "__root__", select: (data) => data.chats });
	return (
		<>
			<PageHeader title="Chats" />
			<Empty>
				<EmptyHeader>
					<EmptyMedia>
						<HugeiconsIcon icon={BubbleChatIcon} strokeWidth={1.5} />
					</EmptyMedia>
					<EmptyTitle>Pick a chat</EmptyTitle>
					<EmptyDescription>Your chats, most recent first. Start a new one from the left pane.</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					{chats.map((chat) => (
						<Link
							key={chat.id}
							to="/chats/$chatId"
							params={{ chatId: chat.id }}
							className="chip-quiet inline-flex h-8 max-w-full items-center rounded-full px-3.5 text-[13.5px] font-medium touch:h-10"
						>
							<span className="truncate">{chat.title}</span>
						</Link>
					))}
				</EmptyContent>
			</Empty>
		</>
	);
}
