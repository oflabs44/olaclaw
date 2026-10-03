import { ArrowDown01Icon, Copy01Icon, Idea01Icon, RefreshIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "cn";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ASK_TOOL } from "@/protocol";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/components/ui/toast";
import { usePiCommands } from "@/pi-session";
import type { PiMessage, PiMessagePart } from "@/transcript";
import { ApprovalBlock, type ApprovalQuestion } from "./approval-block";
import { Markdown } from "./markdown";

export type ToolResult = Extract<PiMessagePart, { type: "tool-result" }>;
type ToolCall = Extract<PiMessagePart, { type: "tool-call" }>;
type ToolStatus = "running" | "done" | "error" | "stopped";

const TOOL_BADGES: Record<ToolStatus, string> = {
	running: "Running",
	done: "Done",
	error: "Error",
	stopped: "Stopped",
};

const rowTriggerClass =
	"group flex w-fit max-w-full cursor-pointer items-center gap-2 -ml-[0.6rem] rounded-full px-[0.6rem] py-[0.3rem] " +
	"text-[13px] text-ink-soft transition-colors select-none hover:bg-wash hover:text-ink touch:min-h-9";

function Chevron() {
	return (
		<HugeiconsIcon
			icon={ArrowDown01Icon}
			size={15}
			strokeWidth={1.5}
			className="opacity-60 transition-transform group-data-panel-open:rotate-180"
		/>
	);
}

function Reasoning({ text, isStreaming }: { text: string; isStreaming: boolean }) {
	// Open while it streams, then closed; the key remounts it so the default applies again.
	return (
		<Collapsible key={isStreaming ? "streaming" : "done"} defaultOpen={isStreaming}>
			<CollapsibleTrigger className={rowTriggerClass}>
				<HugeiconsIcon icon={Idea01Icon} size={17} strokeWidth={1.5} />
				<span className={cn(isStreaming && "text-shimmer")}>{isStreaming ? "Thinking" : "Reasoning"}</span>
				<Chevron />
			</CollapsibleTrigger>
			<CollapsibleContent>
				<p className="my-1 border-l-2 border-line pl-[0.95rem] text-[13.5px] whitespace-pre-wrap text-ink-soft">
					{text}
				</p>
			</CollapsibleContent>
		</Collapsible>
	);
}

function toolResultText(result: ToolResult) {
	return result.content.map((content) => (content.type === "text" ? content.text : "[image]")).join("\n");
}

function toolStatus(result: ToolResult | undefined, isRunning: boolean): ToolStatus {
	if (result) return result.error ? "error" : "done";
	return isRunning ? "running" : "stopped";
}

function ToolRow({
	call,
	result,
	runningOutput,
	isRunNow,
}: {
	call: ToolCall;
	result: ToolResult | undefined;
	/** Streamed output while the tool runs; undefined when it is not running. */
	runningOutput: string | undefined;
	isRunNow: boolean;
}) {
	const status = toolStatus(result, runningOutput !== undefined || isRunNow);
	const output = result ? toolResultText(result) : runningOutput;

	return (
		<Collapsible>
			<CollapsibleTrigger className={cn(rowTriggerClass, "text-ink")}>
				<span
					className={cn(
						"size-[0.45rem] shrink-0 rounded-full",
						status === "running" && "animate-stamp-fast bg-primary",
						status === "done" && "bg-accent",
						status === "error" && "bg-danger",
						status === "stopped" && "bg-ink-faint",
					)}
					aria-hidden="true"
				/>
				<span className="truncate">{call.name}</span>
				<span
					className={cn(
						"rounded-sm px-1.5 text-[11.5px] font-medium",
						status === "running" ? "bg-primary-wash text-primary" : "bg-wash text-ink-soft",
						status === "error" && "text-danger",
					)}
				>
					{TOOL_BADGES[status]}
				</span>
				<Chevron />
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="my-1 grid gap-2.5 border-l-2 border-line pl-[0.95rem]">
					<ToolBlock title="Input">{JSON.stringify(call.arguments, null, 2)}</ToolBlock>
					{output && <ToolBlock title="Output">{output}</ToolBlock>}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

/** The question of an `ask` call. Undefined when the arguments are not what the tool takes. */
function askedQuestion(call: ToolCall): ApprovalQuestion | undefined {
	const args = call.arguments;
	if (typeof args !== "object" || args === null || !("question" in args) || !("options" in args)) return undefined;
	const { question, options } = args;
	const detail = "detail" in args ? args.detail : undefined;
	if (typeof question !== "string" || !Array.isArray(options)) return undefined;
	return {
		question,
		detail: typeof detail === "string" ? detail : undefined,
		options: options.filter((option) => typeof option === "string"),
	};
}

function AskBlock({ call, approval }: { call: ToolCall; approval: ApprovalQuestion }) {
	const { decide } = usePiCommands();

	// The answer ends the tool call, and the result that follows replaces this block.
	function choose(option: string) {
		if (!decide(call.id, option)) {
			toast.add({ title: "Not connected", description: "Try again in a moment." });
		}
	}

	return <ApprovalBlock approval={approval} onDecide={choose} />;
}

function ToolBlock({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div>
			<h4 className="mb-1 text-[0.78rem] font-semibold text-ink-soft">{title}</h4>
			<pre className="overflow-x-auto rounded bg-wash px-2.5 py-2 font-mono text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
				{children}
			</pre>
		</div>
	);
}

function StreamingCursor() {
	return (
		<span
			className="ml-1 inline-block size-[0.45em] animate-stamp-fast rounded-full bg-primary align-middle"
			aria-hidden="true"
		/>
	);
}

function MessageActions({ text }: { text: string }) {
	async function copy() {
		try {
			await navigator.clipboard.writeText(text);
			toast.add({ title: "Copied" });
		} catch {
			toast.add({ title: "Cannot copy", description: "The browser blocked the clipboard." });
		}
	}

	return (
		<div className="flex gap-1 opacity-0 transition-opacity group-focus-within/message:opacity-100 group-hover/message:opacity-100 touch:opacity-100 max-wide:opacity-100">
			<Button onClick={copy}>
				<HugeiconsIcon icon={Copy01Icon} size={17} strokeWidth={1.5} />
				Copy
			</Button>
			<Button onClick={() => toast.add({ title: "Not wired yet", description: "Retry comes later." })}>
				<HugeiconsIcon icon={RefreshIcon} size={17} strokeWidth={1.5} />
				Retry
			</Button>
		</div>
	);
}

function userPartText(part: PiMessagePart): string {
	if (part.type === "text") return part.text;
	if (part.type === "image") return "[image]";
	return "";
}

export function UserMessage({ message }: { message: PiMessage }) {
	return (
		<article className="flex justify-end">
			<p className="max-w-[78%] rounded-[8px_8px_4px_8px] bg-wash px-[0.9rem] py-[0.6rem] whitespace-pre-wrap [overflow-wrap:anywhere] max-wide:max-w-[88%]">
				{message.parts.map(userPartText).join("")}
			</p>
		</article>
	);
}

export function AssistantMessage({
	message,
	isLive,
	isRunNow,
	toolResults,
	runningToolOutput,
}: {
	message: PiMessage;
	isLive: boolean;
	isRunNow: boolean;
	toolResults: ReadonlyMap<string, ToolResult>;
	runningToolOutput: ReadonlyMap<string, string>;
}) {
	const text = message.parts
		.flatMap((part) => (part.type === "text" ? [part.text] : []))
		.join("\n\n")
		.trim();
	const lastPart = message.parts.at(-1);

	return (
		<article className="group/message grid gap-1.5">
			{message.parts.map((part, index) => {
				const isLastPart = index === message.parts.length - 1;
				switch (part.type) {
					case "thinking":
						return <Reasoning key={index} text={part.text} isStreaming={isLive && isLastPart} />;
					case "tool-call": {
						// `ask` waits for a choice while it runs. Once answered it shows as any other tool call.
						const isWaiting = !toolResults.has(part.id) && runningToolOutput.has(part.id);
						const approval = part.name === ASK_TOOL && isWaiting ? askedQuestion(part) : undefined;
						if (approval) return <AskBlock key={part.id} call={part} approval={approval} />;
						return (
							<ToolRow
								key={part.id}
								call={part}
								result={toolResults.get(part.id)}
								runningOutput={runningToolOutput.get(part.id)}
								isRunNow={isRunNow}
							/>
						);
					}
					case "text":
						if (part.text === "" && !(isLive && isLastPart)) return null;
						return (
							<div key={index} className="min-w-0 [overflow-wrap:anywhere]">
								<Markdown text={part.text} isStreaming={isLive && isLastPart} />
								{isLive && isLastPart && <StreamingCursor />}
							</div>
						);
					case "image":
						return (
							<p key={index} className="text-ink-soft">
								[image]
							</p>
						);
					case "tool-result":
						return null;
				}
			})}
			{isLive && lastPart?.type !== "text" && lastPart?.type !== "thinking" && (
				<p>
					<StreamingCursor />
				</p>
			)}
			{message.stopped && <p className="text-[0.88rem] font-semibold text-ink-soft">Stopped</p>}
			{message.fallback && <p className="text-[0.88rem] text-ink-soft">{message.fallback}</p>}
			{message.error && !message.stopped && (
				<p className="text-[0.88rem] text-danger" role="alert">
					{message.error}
				</p>
			)}
			{!isLive && text !== "" && <MessageActions text={text} />}
		</article>
	);
}
