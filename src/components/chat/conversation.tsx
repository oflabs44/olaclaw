import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useStickToBottom } from "use-stick-to-bottom";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useMediaQuery } from "@/lib/use-media-query";
import { usePiSession } from "@/pi-session";
import type { PiMessage } from "@/transcript";
import { AssistantMessage, type ToolResult, UserMessage } from "./message";

function collectToolResults(messages: readonly PiMessage[]) {
	const results = new Map<string, ToolResult>();
	for (const message of messages) {
		for (const part of message.parts) {
			if (part.type === "tool-result") results.set(part.id, part);
		}
	}
	return results;
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

/** The transcript of the root Pi session. It sticks to the bottom while the answer streams. */
export function Conversation() {
	const messages = usePiSession((state) => state.messages);
	const live = usePiSession((state) => state.live);
	const isRunning = usePiSession((state) => state.running);
	const runningTools = usePiSession((state) => state.tools);
	const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
	const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom({
		initial: "instant",
		resize: reduceMotion ? "instant" : "smooth",
	});

	const toolResults = collectToolResults(messages);
	const runningToolOutput = new Map(runningTools.map((tool) => [tool.callId, tool.output]));
	// Tool calls after the last prompt belong to the run in progress, if there is one.
	const currentTurnStart = messages.findLastIndex((message) => message.role === "user");
	const isEmpty = messages.length === 0 && !live && !isRunning;

	return (
		<div className="relative min-h-0 flex-1">
			<div ref={scrollRef} className="absolute inset-0 overflow-y-auto px-[clamp(1rem,4vw,2.5rem)] pt-6 pb-4 max-wide:pt-4">
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
					{messages.map((message, index) => {
						switch (message.role) {
							case "user":
								return <UserMessage key={message.id} message={message} />;
							case "assistant":
								return (
									<AssistantMessage
										key={message.id}
										message={message}
										isLive={false}
										isRunNow={isRunning && index > currentTurnStart}
										toolResults={toolResults}
										runningToolOutput={runningToolOutput}
									/>
								);
							case "notice":
								if (message.parts.length === 0) return null;
								return (
									<p key={message.id} className="text-center text-sm text-ink-faint">
										{message.parts.map((part) => (part.type === "text" ? part.text : "")).join("")}
									</p>
								);
							case "tool":
								// Tool results show inside the tool call they answer.
								return null;
						}
					})}
					{live && (
						<AssistantMessage
							message={live}
							isLive
							isRunNow={isRunning}
							toolResults={toolResults}
							runningToolOutput={runningToolOutput}
						/>
					)}
					{isRunning && !live && runningTools.length === 0 && <WaitingLine />}
				</div>
			</div>
			{!isAtBottom && (
				<button
					type="button"
					onClick={() => scrollToBottom()}
					className="absolute bottom-3 left-1/2 z-10 inline-flex -translate-x-1/2 cursor-pointer items-center gap-1 rounded-full border border-line-strong bg-sheet py-1 pr-3 pl-2 text-[0.86rem] font-semibold shadow-float touch:min-h-10"
				>
					<HugeiconsIcon icon={ArrowDown01Icon} size={17} strokeWidth={1.5} />
					Latest
				</button>
			)}
		</div>
	);
}
