import { BubbleChatIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { chatTree } from "@/components/workspace/chat-tree";
import { PageHeader } from "@/components/workspace/page-header";
import { ChatLink } from "@/components/workspace/workspace-nav";

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
					<EmptyDescription>
						Your chats, most recent first, each branch under its chat. Start a new one from the left pane.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent className="items-stretch gap-0.5 text-left">
					{chatTree(chats).map((row) => (
						<ChatLink key={row.chat.id} row={row} indent={0.7} />
					))}
				</EmptyContent>
			</Empty>
		</>
	);
}
