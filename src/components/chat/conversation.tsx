import { ArrowDown01Icon, GitBranchIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getRouteApi, Link, useLoaderData } from "@tanstack/react-router";
import { Fragment, type ReactNode, useEffect } from "react";
import { useStickToBottom } from "use-stick-to-bottom";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { parentTitle } from "@/components/workspace/chat-tree";
import { useMediaQuery } from "@/lib/use-media-query";
import { usePiSession } from "@/pi-session";
import type { PiMessage } from "@/transcript";
import { AssistantMessage, type ToolResult, UserMessage } from "./message";

const chatRoute = getRouteApi("/chats/$chatId");

// The parent's messages in a branch: quieter until the pointer or the focus is on one.
const fromParentClass = "opacity-65 transition-opacity focus-within:opacity-100 hover:opacity-100";

function collectToolResults(messages: readonly PiMessage[]) {
	const results = new Map<string, ToolResult>();
	for (const message of messages) {
		for (const part of message.parts) {
			if (part.type === "tool-result") results.set(part.id, part);
		}
	}
	return results;
}

type Row = {
	key: string;
	message: PiMessage;
	/** Index in `messages` of the last message in the row; -1 for the live message alone. */
	lastIndex: number;
	isLive: boolean;
};

/**
 * One row per prompt and one per answer. Pi stores an answer with tool calls as several assistant
 * messages with the tool results between them; the row joins their parts so the steps fold into
 * one line. The joined message keeps the id of its last part, which is where a branch starts.
 */
function toRows(messages: readonly PiMessage[], live: PiMessage | null): Row[] {
	const rows: Row[] = [];
	let openAnswer: Row | undefined;

	function addAnswer(message: PiMessage, index: number, isLive: boolean) {
		if (openAnswer) {
			openAnswer.message = { ...message, parts: [...openAnswer.message.parts, ...message.parts] };
			openAnswer.lastIndex = index;
			openAnswer.isLive = isLive;
			return;
		}
		openAnswer = { key: message.id, message, lastIndex: index, isLive };
		rows.push(openAnswer);
	}

	messages.forEach((message, index) => {
		if (message.role === "assistant") {
			addAnswer(message, index, false);
			return;
		}
		if (message.role === "tool") return;
		openAnswer = undefined;
		rows.push({ key: message.id, message, lastIndex: index, isLive: false });
	});
	if (live) addAnswer(live, -1, true);
	return rows;
}

function WaitingLine() {
	const retry = usePiSession((state) => state.retry);
	return (
		<p className="flex items-center gap-2 text-md text-ink-soft">
			<span className="size-[0.4rem] animate-stamp rounded-full bg-primary" aria-hidden="true" />
			{retry ? `Retrying: ${retry.error}` : "Waiting for the model…"}
		</p>
	);
}

/** Where a branch leaves its parent: the messages above are the parent's. */
function ForkDivider({ parentId, title }: { parentId: string; title: string }) {
	return (
		<div className="flex items-center gap-3 text-sm text-ink-soft">
			<span className="h-px flex-1 bg-line" aria-hidden="true" />
			<p className="flex min-w-0 items-center gap-1.5 rounded-full border border-line bg-sheet px-3 py-1">
				<HugeiconsIcon icon={GitBranchIcon} size={14} strokeWidth={1.5} className="shrink-0" />
				<span className="truncate">
					Branched here from{" "}
					<Link
						to="/chats/$chatId"
						params={{ chatId: parentId }}
						search
						className="font-medium text-ink underline decoration-line-strong underline-offset-2"
					>
						{title}
					</Link>
				</span>
			</p>
			<span className="h-px flex-1 bg-line" aria-hidden="true" />
		</div>
	);
}

/**
 * The transcript of the Pi session that `usePiSession` reads: the chat, or a subagent. It sticks to
 * the bottom while the answer streams. `isReadOnly` is for a subagent: nothing in it can be
 * answered or branched, and it has no fork.
 */
export function Conversation({ isReadOnly = false }: { isReadOnly?: boolean }) {
	const messages = usePiSession((state) => state.messages);
	const live = usePiSession((state) => state.live);
	const isRunning = usePiSession((state) => state.running);
	const runningTools = usePiSession((state) => state.tools);
	const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
	const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom({
		initial: "instant",
		resize: reduceMotion ? "instant" : "smooth",
	});

	// The library follows the content, not the pane. The pane gets shorter when the keyboard opens
	// or the composer grows; without this the latest message goes under the composer.
	useEffect(() => {
		const scrollPane = scrollRef.current;
		if (!scrollPane) return;
		const observer = new ResizeObserver(() => {
			void scrollToBottom({ animation: "instant", preserveScrollPosition: true });
		});
		observer.observe(scrollPane);
		return () => observer.disconnect();
	}, [scrollRef, scrollToBottom]);

	const toolResults = collectToolResults(messages);
	const runningToolsById = new Map(runningTools.map((tool) => [tool.callId, tool]));
	// Tool calls after the last prompt belong to the run in progress, if there is one.
	const currentTurnStart = messages.findLastIndex((message) => message.role === "user");
	const isEmpty = !isReadOnly && messages.length === 0 && !live && !isRunning;

	const chat = chatRoute.useLoaderData();
	const parent = useLoaderData({ from: "__root__", select: (data) => parentTitle(chat, data.chats) });
	const forkDivider = !isReadOnly && chat.parentId !== null && <ForkDivider parentId={chat.parentId} title={parent ?? "a chat"} />;
	// -1 when a reset took the shared messages out of the transcript; the divider then goes first.
	const forkIndex = isReadOnly ? -1 : messages.findIndex((message) => message.id === chat.forkEntryId);

	return (
		<div className="relative min-h-0 flex-1">
			<div ref={scrollRef} className="absolute inset-0 overflow-y-auto overscroll-contain px-[clamp(1rem,4vw,2.5rem)] pt-6 pb-4 max-wide:pt-4">
				<div
					ref={contentRef}
					aria-label="Conversation"
					aria-live="polite"
					aria-busy={isRunning}
					className="mx-auto grid max-w-[44rem] gap-[1.4rem] max-wide:gap-[1.1rem] [&>*]:min-w-0"
				>
					{isEmpty && (
						<Empty className="pt-[12vh]">
							<EmptyHeader>
								<EmptyTitle>Ask the first thing</EmptyTitle>
								<EmptyDescription>The answer and the work behind it show here.</EmptyDescription>
							</EmptyHeader>
						</Empty>
					)}
					{forkIndex === -1 && messages.length > 0 && forkDivider}
					{toRows(messages, live).map(({ key, message, lastIndex, isLive }, rowIndex, rows) => {
						const className = !isLive && lastIndex <= forkIndex ? fromParentClass : undefined;
						const firstIndex = rowIndex === 0 ? 0 : rows[rowIndex - 1].lastIndex + 1;
						let row: ReactNode = null;
						switch (message.role) {
							case "user":
								row = <UserMessage message={message} isReadOnly={isReadOnly} className={className} />;
								break;
							case "assistant":
								row = (
									<AssistantMessage
										message={message}
										isLive={isLive}
										isRunNow={isRunning && (isLive || lastIndex > currentTurnStart)}
										toolResults={toolResults}
										runningTools={runningToolsById}
										isReadOnly={isReadOnly}
										className={className}
									/>
								);
								break;
							case "notice":
								if (message.parts.length === 0) break;
								row = (
									<p className="text-center text-sm text-ink-faint">
										{message.parts.map((part) => (part.type === "text" ? part.text : "")).join("")}
									</p>
								);
								break;
							case "tool":
								break;
						}
						return (
							<Fragment key={key}>
								{row}
								{forkIndex >= firstIndex && forkIndex <= lastIndex && forkDivider}
							</Fragment>
						);
					})}
					{isRunning && !live && runningTools.length === 0 && <WaitingLine />}
				</div>
			</div>
			{!isAtBottom && (
				<button
					type="button"
					onClick={() => scrollToBottom()}
					className="absolute bottom-3 left-1/2 z-10 inline-flex -translate-x-1/2 cursor-pointer items-center gap-1 rounded-full border border-line-strong bg-sheet py-1 pr-3 pl-2 text-[0.86rem] font-semibold shadow-float touch:min-h-11"
				>
					<HugeiconsIcon icon={ArrowDown01Icon} size={17} strokeWidth={1.5} />
					Latest
				</button>
			)}
		</div>
	);
}
