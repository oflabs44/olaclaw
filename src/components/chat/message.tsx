import { ArrowDown01Icon, Copy01Icon, GitBranchIcon, Idea01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { cn } from "cn";
import { Fragment, type ReactNode, Suspense, use, useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ASK_TOOL, AYO_EXECUTE_APPROVAL, AYO_EXECUTE_TOOL, ayoExecuteCode, DELEGATE_TOOL } from "@/protocol";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/components/ui/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePiCommands } from "@/pi-session";
import type { PiMessage, PiMessagePart } from "@/transcript";
import type { PiRunningTool } from "@/view";
import { forkChat } from "@/workspace-data";
import type { ChatSummary } from "@/chats";
import { ApprovalBlock, type ApprovalQuestion } from "./approval-block";
import { highlightLines } from "./code-highlighter";
import { Markdown } from "./markdown";
import { SubagentCards } from "./subagent-card";
import { TokenLine } from "./token-line";

export type ToolResult = Extract<PiMessagePart, { type: "tool-result" }>;
export type ToolCall = Extract<PiMessagePart, { type: "tool-call" }>;
export type ToolStatus = "running" | "done" | "error" | "stopped";

const TOOL_BADGES: Record<ToolStatus, string> = {
	running: "Running",
	done: "Done",
	error: "Error",
	stopped: "Stopped",
};

const chatRoute = getRouteApi("/chats/$chatId");

const rowTriggerClass =
	"group flex w-fit max-w-full cursor-pointer items-center gap-2 -ml-[0.6rem] rounded-full px-[0.6rem] py-[0.3rem] " +
	"text-[13px] text-ink-soft transition-colors select-none hover:bg-wash hover:text-ink touch:min-h-11 max-wide:text-[14px]";

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

export function toolResultText(result: ToolResult) {
	return result.content.map((content) => (content.type === "text" ? content.text : "[image]")).join("\n");
}

export function toolStatus(result: ToolResult | undefined, isRunning: boolean): ToolStatus {
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
					<ToolInput call={call} />
					{output && <ToolBlock title="Output" text={output} language={isJson(output) ? "json" : undefined} />}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

type StepPart = Extract<PiMessagePart, { type: "thinking" }> | ToolCall;

function stepLabel(part: StepPart) {
	return part.type === "thinking" ? "Reasoning" : part.name;
}

/** Several steps in one row: "web_search · fetch_url", with the rows inside. */
function Steps({
	parts,
	toolResults,
	isLive,
	isRunNow,
	children,
}: {
	parts: StepPart[];
	toolResults: ReadonlyMap<string, ToolResult>;
	isLive: boolean;
	isRunNow: boolean;
	children: ReactNode;
}) {
	// The tools, each once, in order; reasoning on its own only when there was nothing else.
	const toolNames = [...new Set(parts.flatMap((part) => (part.type === "tool-call" ? [part.name] : [])))];
	const labels = toolNames.length > 0 ? toolNames : ["Reasoning"];
	const hasError = parts.some((part) => part.type === "tool-call" && toolResults.get(part.id)?.error);
	const lastPart = parts.at(-1);
	const liveLabel = lastPart?.type === "thinking" ? "Thinking" : lastPart ? `${stepLabel(lastPart)}…` : "";
	const isStopped = !isLive && !isRunNow && parts.some((part) => part.type === "tool-call" && !toolResults.has(part.id));

	return (
		// Open while it streams, then closed; the key remounts it so the default applies again.
		<Collapsible key={isLive ? "streaming" : "done"} defaultOpen={isLive}>
			<CollapsibleTrigger className={cn(rowTriggerClass, "text-ink")}>
				<span
					className={cn(
						"size-[0.45rem] shrink-0 rounded-full",
						isLive && "animate-stamp-fast bg-primary",
						!isLive && hasError && "bg-danger",
						!isLive && !hasError && (isStopped ? "bg-ink-faint" : "bg-accent"),
					)}
					aria-hidden="true"
				/>
				<span className={cn("truncate", isLive && "text-shimmer")}>{isLive ? liveLabel : labels.join(" · ")}</span>
				<Chevron />
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="my-1 grid gap-1.5 border-l-2 border-line pl-[0.95rem]">{children}</div>
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

/** The approval of an `ayo_execute` call. Undefined when the arguments are not what the tool takes. */
function ayoExecuteApproval(call: ToolCall): ApprovalQuestion | undefined {
	const args = call.arguments;
	if (typeof args !== "object" || args === null || !("code" in args) || typeof args.code !== "string") return undefined;
	return { ...AYO_EXECUTE_APPROVAL, code: ayoExecuteCode(args.code, "params" in args ? args.params : undefined) };
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

function HighlightedText({ text, language }: { text: string; language: string }) {
	const lines = use(highlightLines(text, language));
	if (!lines) return text;
	return lines.map((tokens, index) => (
		<Fragment key={index}>
			{index > 0 && "\n"}
			<TokenLine tokens={tokens} />
		</Fragment>
	));
}

/** A tool call's input or output. With a `language`, the colour arrives after the plain text. */
function ToolBlock({ title, text, language }: { title: string; text: string; language?: string }) {
	return (
		<div>
			<h4 className="mb-1 text-[0.78rem] font-semibold text-ink-soft">{title}</h4>
			<pre className="overflow-x-auto rounded bg-wash px-2.5 py-2 font-mono text-sm whitespace-pre-wrap [tab-size:2] [overflow-wrap:anywhere]">
				{language ? (
					<Suspense fallback={text}>
						<HighlightedText text={text} language={language} />
					</Suspense>
				) : (
					text
				)}
			</pre>
		</div>
	);
}

/** Output that is one JSON value gets JSON colours; a cut or half-streamed value does not parse and stays plain. */
function isJson(text: string): boolean {
	if (!/^\s*[[{]/.test(text)) return false;
	try {
		JSON.parse(text);
		return true;
	} catch {
		return false;
	}
}

/**
 * The input of a tool call. The code of an `ayo_execute` call shows as code, not as one long JSON
 * string with escaped line breaks; the rest of its arguments follow as JSON.
 */
function ToolInput({ call }: { call: ToolCall }) {
	const args = call.arguments;
	if (call.name === AYO_EXECUTE_TOOL && typeof args === "object" && args !== null && "code" in args && typeof args.code === "string") {
		const { code, ...rest } = args;
		return (
			<>
				<ToolBlock title="Code" text={code} language="javascript" />
				{Object.keys(rest).length > 0 && <ToolBlock title="Input" text={JSON.stringify(rest, null, 2)} language="json" />}
			</>
		);
	}
	return <ToolBlock title="Input" text={JSON.stringify(args, null, 2)} language="json" />;
}

function StreamingCursor() {
	return (
		<span
			className="ml-1 inline-block size-[0.45em] animate-stamp-fast rounded-full bg-primary align-middle"
			aria-hidden="true"
		/>
	);
}

// Shown on hover or focus where there is a pointer; always on touch and narrow screens.
const actionRowClass =
	"flex gap-1 opacity-0 transition-opacity group-focus-within/message:opacity-100 group-hover/message:opacity-100 touch:opacity-100 max-wide:opacity-100";

/** Starts a chat that shares this one's transcript up to the message, and opens it. */
function BranchButton({ entryId }: { entryId: string }) {
	const chatId = chatRoute.useParams({ select: (params) => params.chatId });
	const router = useRouter();
	// A second tap while the first one runs would make a second branch, and chats cannot be deleted yet.
	const [isBranching, setIsBranching] = useState(false);

	async function branch() {
		if (isBranching) return;
		setIsBranching(true);
		let chat: ChatSummary;
		try {
			chat = await forkChat({ data: { chatId, entryId } });
		} catch (error) {
			console.error(`Cannot branch chat ${chatId} at ${entryId}`, error);
			setIsBranching(false);
			// The branch may exist when only the reply was lost, so the list is the place to check.
			toast.add({ title: "Could not branch the chat", description: "Check the chat list before you try again." });
			void router.invalidate();
			return;
		}
		await router.invalidate();
		await router.navigate({ to: "/chats/$chatId", params: { chatId: chat.id }, search: true });
		setIsBranching(false);
	}

	return (
		<ActionButton label="Branch" disabled={isBranching} onClick={branch}>
			<HugeiconsIcon icon={GitBranchIcon} size={17} strokeWidth={1.5} />
		</ActionButton>
	);
}

/** An icon-only row action; the label is for screen readers and the tooltip. */
function ActionButton({ label, ...props }: Omit<ButtonProps, "icon" | "aria-label"> & { label: string }) {
	return (
		<Tooltip>
			<TooltipTrigger render={<Button icon aria-label={label} {...props} />} />
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

function MessageActions({ text, entryId, canBranch }: { text: string; entryId: string; canBranch: boolean }) {
	async function copy() {
		try {
			await navigator.clipboard.writeText(text);
			toast.add({ title: "Copied" });
		} catch {
			toast.add({ title: "Cannot copy", description: "The browser blocked the clipboard." });
		}
	}

	return (
		<div className={actionRowClass}>
			<ActionButton label="Copy" onClick={copy}>
				<HugeiconsIcon icon={Copy01Icon} size={17} strokeWidth={1.5} />
			</ActionButton>
			{canBranch && <BranchButton entryId={entryId} />}
		</div>
	);
}

function userPartText(part: PiMessagePart): string {
	if (part.type === "text") return part.text;
	if (part.type === "image") return "[image]";
	return "";
}

export function UserMessage({
	message,
	isReadOnly,
	className,
}: {
	message: PiMessage;
	isReadOnly: boolean;
	className?: string;
}) {
	return (
		// Phones show the action under the bubble; wide screens have room for it beside the bubble.
		<article
			className={cn(
				"group/message flex flex-col items-end gap-1 wide:flex-row-reverse wide:items-center wide:justify-start",
				className,
			)}
		>
			<p className="max-w-[78%] rounded-[8px_8px_4px_8px] bg-wash-strong px-[0.9rem] py-[0.6rem] whitespace-pre-wrap [overflow-wrap:anywhere] max-wide:max-w-[88%] max-wide:text-[17px] max-wide:leading-[1.55]">
				{message.parts.map(userPartText).join("")}
			</p>
			{!isReadOnly && (
				<div className={actionRowClass}>
					<BranchButton entryId={message.id} />
				</div>
			)}
		</article>
	);
}

export function AssistantMessage({
	message,
	isLive,
	isRunNow,
	toolResults,
	runningTools,
	isReadOnly,
	className,
}: {
	message: PiMessage;
	isLive: boolean;
	isRunNow: boolean;
	toolResults: ReadonlyMap<string, ToolResult>;
	/** The tool calls that run now, by call id. */
	runningTools: ReadonlyMap<string, PiRunningTool>;
	/** A subagent's transcript: it shows what happened and takes no answer and no branch. */
	isReadOnly: boolean;
	className?: string;
}) {
	const text = message.parts
		.flatMap((part) => (part.type === "text" ? [part.text] : []))
		.join("\n\n")
		.trim();
	const lastPart = message.parts.at(-1);

	// Reasoning and tool calls that follow each other fold into one Steps row, so the answer is
	// not pushed down by one line per step. An `ask` that waits for a choice stands on its own, and
	// so do subagents: `delegate` calls that follow each other make one stack of cards.
	const blocks: ReactNode[] = [];
	let steps: StepPart[] = [];
	let delegateCalls: ToolCall[] = [];

	function flushDelegateCalls() {
		if (delegateCalls.length === 0) return;
		const calls = delegateCalls;
		delegateCalls = [];
		blocks.push(
			<SubagentCards
				key={`subagents-${calls[0].id}`}
				calls={calls}
				toolResults={toolResults}
				runningTools={runningTools}
				isRunNow={isRunNow}
			/>,
		);
	}

	function flushSteps() {
		if (steps.length === 0) return;
		const group = steps;
		steps = [];
		const isGroupLive = isLive && group.at(-1) === lastPart;
		const rows = group.map((part) =>
			part.type === "thinking" ? (
				<Reasoning key={message.parts.indexOf(part)} text={part.text} isStreaming={isGroupLive && part === lastPart} />
			) : (
				<ToolRow
					key={part.id}
					call={part}
					result={toolResults.get(part.id)}
					runningOutput={runningTools.get(part.id)?.output}
					isRunNow={isRunNow}
				/>
			),
		);
		blocks.push(
			group.length === 1 ? (
				rows[0]
			) : (
				<Steps key={`steps-${message.parts.indexOf(group[0])}`} parts={group} toolResults={toolResults} isLive={isGroupLive} isRunNow={isRunNow}>
					{rows}
				</Steps>
			),
		);
	}

	function flushGroups() {
		flushSteps();
		flushDelegateCalls();
	}

	message.parts.forEach((part, index) => {
		const isLastPart = index === message.parts.length - 1;
		switch (part.type) {
			case "thinking":
				flushDelegateCalls();
				steps.push(part);
				return;
			case "tool-call": {
				if (part.name === DELEGATE_TOOL) {
					flushSteps();
					delegateCalls.push(part);
					return;
				}
				// `ask` waits for a choice while it runs. Once answered it shows as any other tool call.
				const isWaiting = !isReadOnly && !toolResults.has(part.id) && runningTools.has(part.id);
				let approval: ApprovalQuestion | undefined;
				if (isWaiting && part.name === ASK_TOOL) approval = askedQuestion(part);
				// `ayo_execute` reports details once Oladayo approved it; from then on it only runs.
				if (isWaiting && part.name === AYO_EXECUTE_TOOL && runningTools.get(part.id)?.details === undefined) {
					approval = ayoExecuteApproval(part);
				}
				if (!approval) {
					flushDelegateCalls();
					steps.push(part);
					return;
				}
				flushGroups();
				blocks.push(<AskBlock key={part.id} call={part} approval={approval} />);
				return;
			}
			case "text":
				if (part.text === "" && !(isLive && isLastPart)) return;
				flushGroups();
				blocks.push(
					<div key={index} className="min-w-0 [overflow-wrap:anywhere]">
						<Markdown text={part.text} isStreaming={isLive && isLastPart} />
						{isLive && isLastPart && <StreamingCursor />}
					</div>,
				);
				return;
			case "image":
				flushGroups();
				blocks.push(
					<p key={index} className="text-ink-soft">
						[image]
					</p>,
				);
				return;
			case "tool-result":
				return;
		}
	});
	flushGroups();

	return (
		<article className={cn("group/message grid gap-1.5 [&>*]:min-w-0", className)}>
			{blocks}
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
			{!isLive && text !== "" && <MessageActions text={text} entryId={message.id} canBranch={!isReadOnly} />}
		</article>
	);
}
