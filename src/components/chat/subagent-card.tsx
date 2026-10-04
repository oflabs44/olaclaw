import type { JsonValue } from "@earendil-works/pi-ai";
import type { UsageState } from "@earendil-works/pi-durable";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getRouteApi, useLocation, useRouter } from "@tanstack/react-router";
import { cn } from "cn";
import { createContext, type ReactNode, use, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsPhone } from "@/components/workspace/panels";
import { MODELS } from "@/models";
import { type PiSessionState, SubagentSessionProvider, usePiSession } from "@/pi-session";
import type { DelegateDetails } from "@/protocol";
import type { PiRunningTool } from "@/view";
import { Conversation } from "./conversation";
import { type ToolCall, type ToolResult, type ToolStatus, toolResultText, toolStatus } from "./message";

declare module "@tanstack/react-router" {
	interface HistoryState {
		/** This history entry was made when a subagent's transcript opened, so Back closes it. */
		openedSubagent?: boolean;
	}
}

const chatRoute = getRouteApi("/chats/$chatId");

/** The pane beside the chat that the open subagent's transcript renders into on a wide screen. */
export const SubagentPaneContext = createContext<HTMLElement | null>(null);

const STATUS_LABELS: Record<ToolStatus, string> = {
	running: "Working",
	done: "Done",
	error: "Failed",
	stopped: "Stopped",
};

type Subagent = {
	readonly title: string;
	/** Undefined until the `delegate` call reports the conversation it made, and again when the call stopped without a result. */
	readonly conversationId: string | undefined;
	readonly modelLabel: string | undefined;
	readonly status: ToolStatus;
	/** What the call reported: the clock and the spend, so a finished card needs no socket. */
	readonly startedAt: number | undefined;
	readonly endedAt: number | undefined;
	readonly usage: UsageState | undefined;
};

/** Tool arguments or tool details as an object. They come from the model and the server, so the shape is not known. */
function jsonObject(value: JsonValue | undefined): Readonly<Record<string, JsonValue>> | undefined {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
	// Array.isArray does not narrow a readonly array away, so the object needs the cast.
	return value as Readonly<Record<string, JsonValue>>;
}

function stringField(value: JsonValue | undefined, name: string): string | undefined {
	const field = jsonObject(value)?.[name];
	return typeof field === "string" ? field : undefined;
}

// The details come back as JSON, so each field is read by its name; the name is checked against the type.
function detailString(details: JsonValue | undefined, name: keyof DelegateDetails): string | undefined {
	return stringField(details, name);
}

function detailNumber(details: JsonValue | undefined, name: keyof DelegateDetails): number | undefined {
	const field = jsonObject(details)?.[name];
	return typeof field === "number" ? field : undefined;
}

/** The subagent's `pi.usage` as the call reported it; the shape is pi's, so only the outline is checked. */
function detailUsage(details: JsonValue | undefined): UsageState | undefined {
	const usage = jsonObject(jsonObject(details)?.usage);
	if (usage === undefined) return undefined;
	return "models" in usage && "tools" in usage ? (usage as unknown as UsageState) : undefined;
}

function toolActivity(name: string, toolArguments: JsonValue | undefined): string {
	if (name === "web_search") return "Searching…";
	const url = stringField(toolArguments, "url");
	if (name === "fetch_url" && url !== undefined && URL.canParse(url)) return `Reading ${new URL(url).hostname}…`;
	return `${name}…`;
}

const ACTIVITY_TAIL_LENGTH = 80;

/** One line on what the subagent does now: its running tool, or the end of the text it writes. */
function liveActivity(state: PiSessionState): string {
	const runningTool = state.tools.at(-1);
	if (runningTool) {
		const call = state.messages
			.flatMap((message) => message.parts)
			.findLast((part) => part.type === "tool-call" && part.id === runningTool.callId);
		return toolActivity(runningTool.name, call?.type === "tool-call" ? call.arguments : undefined);
	}
	const livePart = state.live?.parts.at(-1);
	if (livePart?.type === "tool-call") return toolActivity(livePart.name, livePart.arguments);
	if (livePart?.type === "thinking") return "Thinking…";
	if (livePart?.type === "text") {
		const text = livePart.text.replace(/\s+/g, " ").trim();
		if (text.length > ACTIVITY_TAIL_LENGTH) return `…${text.slice(-ACTIVITY_TAIL_LENGTH)}`;
		if (text !== "") return text;
	}
	return state.retry ? "Retrying…" : "Working…";
}

/** The text of the subagent's last answer, for a run that stopped before it gave a result. */
function lastAnswerText(state: PiSessionState): string {
	const answer = state.live ?? state.messages.findLast((message) => message.role === "assistant");
	return (answer?.parts ?? []).map((part) => (part.type === "text" ? part.text : "")).join(" ");
}

const compactNumber = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function formatUsage(usage: UsageState): string {
	let tokens = 0;
	let cost = 0;
	for (const spent of [...Object.values(usage.models), ...Object.values(usage.tools)]) {
		tokens += spent.totalTokens;
		cost += spent.cost.total;
	}
	const tokenText = `${compactNumber.format(tokens)} tokens`;
	if (cost === 0) return tokenText;
	return `${tokenText} · ${cost < 0.01 ? "under $0.01" : `$${cost.toFixed(2)}`}`;
}

function formatDuration(seconds: number): string {
	if (seconds < 60) return `${seconds}s`;
	return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

function subscribeToSeconds(onTick: () => void) {
	const interval = setInterval(onTick, 1000);
	return () => clearInterval(interval);
}

function subscribeToNothing() {
	return () => {};
}

function nowInSeconds() {
	return Math.floor(Date.now() / 1000);
}

/**
 * How long the subagent has worked, or worked in total once it stopped. The clock ticks only
 * while it works. The call's own clock comes first; the transcript's timestamps serve a stopped
 * card, whose call left no result to carry the clock.
 */
function useElapsed(subagent: Subagent): string | undefined {
	const isWorking = subagent.status === "running";
	const firstMessageAt = usePiSession((state) => state.messages[0]?.timestamp);
	const lastMessageAt = usePiSession((state) => state.messages.at(-1)?.timestamp);
	const now = useSyncExternalStore(isWorking ? subscribeToSeconds : subscribeToNothing, nowInSeconds, () => 0);
	const startedAt = subagent.startedAt ?? firstMessageAt;
	if (startedAt === undefined) return undefined;
	const startSeconds = Math.floor(startedAt / 1000);
	const endSeconds = isWorking ? now : Math.floor((subagent.endedAt ?? lastMessageAt ?? startedAt) / 1000);
	return formatDuration(Math.max(0, endSeconds - startSeconds));
}

function useUsage(subagent: Subagent): string | undefined {
	const liveUsage = usePiSession((state) => state.usage);
	const usage = subagent.usage ?? liveUsage;
	return usage ? formatUsage(usage) : undefined;
}

function StatusDot({ status }: { status: ToolStatus }) {
	return (
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
	);
}

function ModelPill({ label }: { label: string }) {
	return <span className="shrink-0 rounded-full bg-wash px-2 py-px text-[11.5px] font-medium text-ink-soft">{label}</span>;
}

function StatusLabel({ subagent }: { subagent: Subagent }) {
	const isWorking = subagent.status === "running";
	return (
		<span
			className={cn(
				"shrink-0 text-[12.5px] font-medium text-ink-soft",
				isWorking && "text-shimmer",
				subagent.status === "error" && "text-danger",
			)}
		>
			{isWorking && subagent.conversationId === undefined ? "Starting…" : STATUS_LABELS[subagent.status]}
		</span>
	);
}

/** The card's lines under the title: what the subagent does now, or what it answered. */
function CardBody({ subagent, resultText }: { subagent: Subagent; resultText: string | undefined }) {
	const isWorking = subagent.status === "running";
	const isReconnecting = usePiSession((state) => state.status === "closed");
	const activity = usePiSession(liveActivity);
	const producedText = usePiSession(lastAnswerText);
	const elapsed = useElapsed(subagent);
	const usage = useUsage(subagent);
	const lineClass = "text-[13px] text-ink-soft [overflow-wrap:anywhere] max-wide:text-[14px]";

	if (isWorking) {
		if (subagent.conversationId === undefined) return null;
		return (
			<span className={cn(lineClass, "flex items-baseline gap-2")}>
				<span className="min-w-0 flex-1 truncate">{isReconnecting ? "Reconnecting…" : activity}</span>
				{elapsed && <span className="shrink-0 text-[12px] text-ink-faint tabular-nums">{elapsed}</span>}
			</span>
		);
	}
	const excerpt = (resultText ?? producedText).trim();
	return (
		<>
			{excerpt !== "" && <span className={cn(lineClass, "line-clamp-2")}>{excerpt}</span>}
			{usage && <span className="text-[12px] text-ink-faint tabular-nums">{usage}</span>}
		</>
	);
}

function TranscriptHeader({
	subagent,
	title,
	onClose,
}: {
	subagent: Subagent;
	/** The title element: a sheet names itself with its own title component. */
	title: ReactNode;
	/** Shows a Close button; a sheet closes on a swipe and needs none. */
	onClose?: () => void;
}) {
	const isReconnecting = usePiSession((state) => state.status === "closed");
	const error = usePiSession((state) => state.error);
	const elapsed = useElapsed(subagent);
	const usage = useUsage(subagent);
	const facts = [elapsed, usage].filter((fact) => fact !== undefined);

	return (
		<header className="flex items-start gap-2 border-b border-line px-[clamp(1rem,4vw,2.5rem)] pt-1 pb-2.5 wide:px-4 wide:pt-3">
			<div className="grid min-w-0 flex-1 gap-1">
				<div className="flex min-w-0 items-center gap-2">
					<StatusDot status={subagent.status} />
					{title}
					{subagent.modelLabel && <ModelPill label={subagent.modelLabel} />}
				</div>
				<p className="flex flex-wrap items-baseline gap-x-2 text-[12.5px] text-ink-faint tabular-nums">
					<StatusLabel subagent={subagent} />
					{facts.length > 0 && <span>{facts.join(" · ")}</span>}
					{isReconnecting && <span role="status">Reconnecting…</span>}
				</p>
				{error && (
					<p role="alert" className="text-[12.5px] text-danger">
						{error}
					</p>
				)}
			</div>
			{onClose && (
				<Button icon aria-label="Close the subagent" onClick={onClose} className="-mr-1.5">
					<HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={1.5} />
				</Button>
			)}
		</header>
	);
}

/** The subagent's own transcript: a bottom sheet on a phone, the pane beside the chat on a wide screen. */
function SubagentTranscript({ subagent, isOpen, onClose }: { subagent: Subagent; isOpen: boolean; onClose: () => void }) {
	const isPhone = useIsPhone();
	const pane = use(SubagentPaneContext);
	const titleClass = "min-w-0 truncate text-[0.95rem] font-semibold";

	return (
		<>
			<Sheet
				open={isPhone && isOpen}
				onOpenChange={(open) => {
					if (!open) onClose();
				}}
			>
				<SheetContent className="pt-2 pb-[env(safe-area-inset-bottom)]">
					<span className="mx-auto mt-0.5 mb-1.5 block h-1 w-10 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
					<TranscriptHeader subagent={subagent} title={<SheetTitle className={titleClass}>{subagent.title}</SheetTitle>} />
					<Conversation isReadOnly />
				</SheetContent>
			</Sheet>
			{!isPhone &&
				isOpen &&
				pane &&
				createPortal(
					<>
						<TranscriptHeader subagent={subagent} title={<h2 className={titleClass}>{subagent.title}</h2>} onClose={onClose} />
						<Conversation isReadOnly />
					</>,
					pane,
				)}
		</>
	);
}

function SubagentCard({
	call,
	result,
	runningTool,
	isRunNow,
}: {
	call: ToolCall;
	result: ToolResult | undefined;
	/** The call while it runs; undefined when it is not running. */
	runningTool: PiRunningTool | undefined;
	isRunNow: boolean;
}) {
	const router = useRouter();
	const navigate = chatRoute.useNavigate();
	const openConversationId = chatRoute.useSearch({ select: (search) => search.agent });
	const isOpenedEntry = useLocation({ select: (location) => location.state.openedSubagent === true });

	const details = result?.details ?? runningTool?.details;
	const modelId = detailString(details, "model") ?? stringField(call.arguments, "model");
	const subagent: Subagent = {
		title: stringField(call.arguments, "title") ?? "Subagent",
		conversationId: detailString(details, "conversationId"),
		modelLabel: MODELS.find((model) => model.id === modelId)?.label.replace(/^Claude /, ""),
		status: toolStatus(result, runningTool !== undefined || isRunNow),
		startedAt: detailNumber(details, "startedAt"),
		endedAt: detailNumber(details, "endedAt"),
		usage: detailUsage(details),
	};
	const { conversationId } = subagent;
	const isOpen = conversationId !== undefined && openConversationId === conversationId;

	function open() {
		void navigate({
			search: (previous) => ({ ...previous, agent: conversationId }),
			// A new history entry, so Back closes the transcript; a second subagent takes the entry of the first
			// and keeps its state, so a chat entered with `?agent=` from elsewhere does not get a flag it did not earn.
			replace: openConversationId !== undefined,
			state: (previous) => (openConversationId === undefined ? { ...previous, openedSubagent: true } : previous),
		});
	}

	function close() {
		// Leave no second entry of the chat behind. A page that loaded with the transcript open has
		// no entry of its own to go back to.
		if (isOpenedEntry && router.history.canGoBack()) {
			router.history.back();
			return;
		}
		void navigate({ search: (previous) => ({ ...previous, agent: undefined }), replace: true });
	}

	return (
		<li>
			<SubagentSessionProvider conversationId={conversationId} isWatching={subagent.status === "running" || isOpen}>
				<button
					type="button"
					onClick={open}
					disabled={conversationId === undefined}
					aria-expanded={isOpen}
					className={cn(
						"grid w-full cursor-pointer gap-0.5 px-3.5 py-2.5 text-left transition-colors hover:bg-wash-soft",
						"disabled:cursor-default disabled:hover:bg-transparent touch:min-h-11",
						isOpen && "bg-wash-soft",
					)}
				>
					<span className="flex min-w-0 items-center gap-2">
						<StatusDot status={subagent.status} />
						<span className="min-w-0 truncate text-[14px] font-medium max-wide:text-[15px]">{subagent.title}</span>
						{subagent.modelLabel && <ModelPill label={subagent.modelLabel} />}
						<span className="flex-1" />
						<StatusLabel subagent={subagent} />
					</span>
					<CardBody subagent={subagent} resultText={result && toolResultText(result)} />
				</button>
				<SubagentTranscript subagent={subagent} isOpen={isOpen} onClose={close} />
			</SubagentSessionProvider>
		</li>
	);
}

/** The `delegate` calls that follow each other in one answer: one card per subagent, in one stack. */
export function SubagentCards({
	calls,
	toolResults,
	runningTools,
	isRunNow,
}: {
	calls: readonly ToolCall[];
	toolResults: ReadonlyMap<string, ToolResult>;
	runningTools: ReadonlyMap<string, PiRunningTool>;
	isRunNow: boolean;
}) {
	return (
		<ul
			aria-label={calls.length === 1 ? "Subagent" : `${calls.length} subagents`}
			className="my-0.5 grid divide-y divide-line overflow-hidden rounded-card border border-line bg-sheet"
		>
			{calls.map((call) => (
				<SubagentCard
					key={call.id}
					call={call}
					result={toolResults.get(call.id)}
					runningTool={runningTools.get(call.id)}
					isRunNow={isRunNow}
				/>
			))}
		</ul>
	);
}
