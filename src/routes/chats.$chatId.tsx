import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Composer } from "@/components/chat/composer";
import { Conversation } from "@/components/chat/conversation";
import { SubagentPaneContext } from "@/components/chat/subagent-card";
import { parentTitle } from "@/components/workspace/chat-tree";
import { useActiveDesk } from "@/components/workspace/current-place";
import { DeskStrip } from "@/components/workspace/desk-strip";
import { PageHeader } from "@/components/workspace/page-header";
import { PiSessionProvider, usePiSession } from "@/pi-session";
import { getChat, getDesk } from "@/workspace-data";

// The subagent whose transcript is open: the conversation id that its `delegate` call reports.
const chatSearch = z.object({
	agent: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/chats/$chatId")({
	staticData: { section: "Chats" },
	validateSearch: chatSearch,
	loader: async ({ params }) => {
		const chat = await getChat({ data: { chatId: params.chatId } });
		// The strip of a chat at a desk shows the desk's newest note. A chat still opens without it.
		const desk =
			chat.deskId === null
				? undefined
				: await getDesk({ data: { deskId: chat.deskId } }).catch((error: unknown) => {
						console.error(`Cannot read desk ${chat.deskId} for the strip`, error);
						return undefined;
					});
		return { ...chat, latestDeskNote: desk?.notes.at(-1)?.text };
	},
	component: ChatPage,
});

function WorkingIndicator() {
	return (
		<span className="inline-flex shrink-0 items-center gap-2 text-[13px] text-ink-soft max-wide:px-2">
			<span className="size-1.5 animate-stamp rounded-full bg-ink-soft" aria-hidden="true" />
			{/* A phone has room for the dot only. */}
			<span className="max-wide:sr-only">Working</span>
		</span>
	);
}

function ChatPage() {
	const chatId = Route.useParams({ select: (params) => params.chatId });
	const forkEntryId = Route.useLoaderData({ select: (chat) => chat.forkEntryId });
	// The open subagent's card renders its transcript into this pane; phones use a sheet instead.
	const [subagentPane, setSubagentPane] = useState<HTMLElement | null>(null);
	return (
		<PiSessionProvider key={chatId} chatId={chatId} forkEntryId={forkEntryId}>
			<ChatHeader />
			<div className="flex min-h-0 flex-1">
				<div className="flex min-w-0 flex-1 flex-col">
					<SubagentPaneContext value={subagentPane}>
						<Conversation />
					</SubagentPaneContext>
					<Composer />
				</div>
				<aside
					ref={setSubagentPane}
					aria-label="Subagent"
					className="flex w-[min(30rem,45%)] flex-col border-l border-line empty:hidden max-wide:hidden"
				/>
			</div>
		</PiSessionProvider>
	);
}

function ChatHeader() {
	const chat = Route.useLoaderData();
	const parent = useLoaderData({ from: "__root__", select: (data) => parentTitle(chat, data.chats) });
	const desk = useActiveDesk();
	const isRunning = usePiSession((state) => state.running);
	return (
		<>
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
			{desk && <DeskStrip desk={desk} latestNote={chat.latestDeskNote} />}
		</>
	);
}
