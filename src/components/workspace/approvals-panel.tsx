import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link, useLoaderData, useNavigate, useParams, useRouter, useSearch } from "@tanstack/react-router";
import { cn } from "cn";
import { type ReactNode, Suspense, use } from "react";
import { ApprovalBlock, ApprovalCard, ApprovalCode } from "@/components/chat/approval-block";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { ayoExecuteParts } from "@/protocol";
import { type Approval, type DecidedApproval, decideApproval, getDecidedApproval } from "@/workspace-data";
import { useIsPhone } from "./panels";

const TIME_ZONE = "Europe/Berlin";

/** The time for today, the date for a day before, with the year for another year. A fixed locale and zone, so the server render and the hydrating client agree. */
function formatWhen(epochMilliseconds: number): string {
	const date = new Date(epochMilliseconds);
	const day = (value: Date) => value.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
	if (day(date) === day(new Date())) {
		return date.toLocaleTimeString("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
	}
	// The year only when it is not this one: the pane is narrow.
	const year = (value: Date) => value.toLocaleDateString("en-GB", { timeZone: TIME_ZONE, year: "numeric" });
	return date.toLocaleDateString("en-GB", {
		timeZone: TIME_ZONE,
		day: "numeric",
		month: "short",
		year: year(date) === year(new Date()) ? undefined : "numeric",
	});
}

/** What Oladayo chose: the option as Phoebe wrote it, or his own words in quotation marks. */
function choiceText(options: readonly string[], decision: string): string {
	return options.includes(decision) ? decision : `“${decision}”`;
}

// The full request of the open card. A render must get the same promise each time, so the load is kept here.
const approvalLoads = new Map<string, Promise<DecidedApproval | null>>();

function loadApproval(callId: string): Promise<DecidedApproval | null> {
	let load = approvalLoads.get(callId);
	if (!load) {
		load = getDecidedApproval({ data: { callId } }).catch((error) => {
			console.error("Cannot load the approval", error);
			return null;
		});
		approvalLoads.set(callId, load);
	}
	return load;
}

function ApprovalDetail({ callId }: { callId: string }) {
	const approval = use(loadApproval(callId));
	if (!approval) return <DialogTitle className="pr-9 touch:pr-12">This approval could not be loaded</DialogTitle>;

	return (
		<>
			<div className="grid gap-1 pr-9 touch:pr-12">
				<p className="text-[0.82rem] text-ink-soft">Phoebe asked</p>
				<DialogTitle className="text-[1.02rem] leading-snug">{approval.question}</DialogTitle>
				{approval.detail && <p className="text-[0.9rem] leading-snug text-ink-soft">{approval.detail}</p>}
			</div>
			{approval.code ? (
				<ApprovalCode {...ayoExecuteParts(approval.code)} />
			) : (
				<ul className="grid gap-1.5" aria-label="Options">
					{approval.options.map((option) => {
						const isChosen = option === approval.decision;
						return (
							<li
								key={option}
								className={cn(
									"flex min-h-11 items-center gap-3 rounded px-3 py-2 text-[0.95rem]",
									isChosen ? "bg-wash-strong font-medium" : "border border-line text-ink-soft",
								)}
							>
								<span className="min-w-0 flex-1">{option}</span>
								{isChosen && <span className="shrink-0 text-[0.75rem] font-normal text-ink-soft">Your choice</span>}
							</li>
						);
					})}
				</ul>
			)}
			<p className="text-[0.9rem] text-ink-soft [overflow-wrap:anywhere]">
				You chose{" "}
				<span className="font-medium text-ink">{choiceText(approval.options, approval.decision)}</span> ·{" "}
				{formatWhen(approval.decidedAt)}
			</p>
		</>
	);
}

/** The open decided approval in full. Its id is a search param, so a reload keeps it open. */
function ApprovalDialog() {
	const openCallId = useSearch({ from: "__root__", select: (search) => search.approval });
	const navigate = useNavigate();

	return (
		<Dialog
			open={openCallId !== undefined}
			onOpenChange={(open) => {
				if (!open) void navigate({ to: ".", search: (previous) => ({ ...previous, approval: undefined }), replace: true });
			}}
		>
			{/* The dialog scrolls as a whole, so the code panels inside stay unclipped. */}
			<DialogContent className="top-[8vh] max-h-[84dvh] w-[min(44rem,calc(100%-2rem))] overflow-y-auto p-4">
				<DialogClose render={<Button icon aria-label="Close" className="absolute top-2 right-2" />}>
					<HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={1.5} />
				</DialogClose>
				{openCallId !== undefined && (
					<Suspense fallback={<DialogTitle className="pr-9 font-normal text-ink-soft touch:pr-12">Loading…</DialogTitle>}>
						<ApprovalDetail callId={openCallId} />
					</Suspense>
				)}
			</DialogContent>
		</Dialog>
	);
}

/**
 * A decided approval as one row of the history; it opens the full request. A question shows what was
 * asked and the answer. A code approval shows what the code calls in Ayo, because its question is
 * always the same, and names the answer only when the code did not run.
 */
function DecidedRow({
	approval,
	decision,
	children,
}: {
	approval: Approval;
	decision: string;
	/** Shown under the row's lines, for example where the question comes from. */
	children?: ReactNode;
}) {
	const navigate = useNavigate();
	const lineCount = approval.codeLineCount;
	const isCode = lineCount !== undefined;
	const calls = approval.codeCalls ?? [];
	const ran = isCode && decision === approval.options[0];

	function open() {
		// A load that failed must not stay, and a load is small, so each opening starts a new one.
		approvalLoads.delete(approval.id);
		void navigate({ to: ".", search: (previous) => ({ ...previous, approval: approval.id }), replace: true });
	}

	return (
		<div className="grid text-[0.9rem]">
			<button
				type="button"
				aria-haspopup="dialog"
				onClick={open}
				className="grid cursor-pointer gap-0.5 rounded px-2 py-2 text-left transition-colors hover:bg-wash touch:min-h-11"
			>
				<span className="flex items-baseline justify-between gap-3">
					{isCode ? (
						<span className="min-w-0 font-mono text-[0.8rem] leading-snug [overflow-wrap:anywhere]">
							{calls.length > 0 ? calls.join(", ") : "Code in Ayo"}
						</span>
					) : (
						<span className="min-w-0 leading-snug font-medium">{approval.question}</span>
					)}
					{approval.decidedAt !== undefined && (
						<span className="shrink-0 text-[0.8rem] text-ink-faint">{formatWhen(approval.decidedAt)}</span>
					)}
				</span>
				<span className="text-[0.82rem] text-ink-soft [overflow-wrap:anywhere]">
					{isCode && `${lineCount} ${lineCount === 1 ? "line" : "lines"}`}
					{isCode && !ran && ", not run: "}
					{(!isCode || !ran) && choiceText(approval.options, decision)}
				</span>
			</button>
			{children && <div className="flex min-w-0 px-2 pb-2">{children}</div>}
		</div>
	);
}

/**
 * The right pane: what Phoebe asked and what Oladayo chose. An open chat shows its own approvals;
 * every other page shows those of all chats, each with a link to its chat.
 */
export function ApprovalsPanel({ isSheet = false }: { isSheet?: boolean }) {
	const openChatId = useParams({ strict: false, select: (params) => params.chatId });
	const allApprovals = useLoaderData({ from: "__root__", select: (data) => data.approvals });
	const chats = useLoaderData({ from: "__root__", select: (data) => data.chats });
	const isPhone = useIsPhone();
	const router = useRouter();
	const approvals =
		openChatId === undefined ? allApprovals : allApprovals.filter((approval) => approval.chatId === openChatId);
	const waiting = approvals.filter((approval) => approval.decision === undefined);
	const heading = "px-2 py-1 text-[0.95rem] font-semibold";

	// On a page without a chat, each entry says which chat it comes from.
	function chatLink(approval: Approval) {
		return (
			openChatId === undefined && (
				<Link
					to="/chats/$chatId"
					params={{ chatId: approval.chatId }}
					className="truncate text-[0.82rem] text-ink-soft underline underline-offset-4"
				>
					{chats.find((chat) => chat.id === approval.chatId)?.title ?? "Chat"}
				</Link>
			)
		);
	}

	// Not through the chat socket: that one answers only for the open chat.
	async function decide(callId: string, answer: string) {
		try {
			await decideApproval({ data: { callId, answer } });
		} catch (error) {
			console.error("Cannot send the answer", error);
			toast.add({ title: "Could not send your answer", description: "Try again in a moment." });
		}
		// Also after a failure: the question may be gone already.
		await router.invalidate();
	}

	return (
		<div className="flex flex-col gap-3">
			{isSheet ? (
				<SheetTitle className={cn(heading, "text-center")}>Approvals</SheetTitle>
			) : (
				<h2 className={heading}>Approvals</h2>
			)}
			{approvals.length === 0 && (
				<Empty className="items-start p-0 px-2 text-left">
					<EmptyDescription className="text-[0.9rem]">
						{openChatId === undefined ? "No approvals yet" : "No approvals in this chat yet"}
					</EmptyDescription>
				</Empty>
			)}
			{waiting.length > 0 && (
				<ul className="grid gap-2 px-0.5">
					{waiting.map((approval) => {
						const className = "px-3 py-2.5 text-[0.9rem]";
						return (
							<li key={approval.id}>
								{approval.codeLineCount !== undefined ? (
									// This pane is too narrow to read code, and Oladayo must read it before he answers.
									<ApprovalCard approval={approval} className={className}>
										{chatLink(approval)}
										<Button
											variant="quiet"
											nativeButton={false}
											render={<Link to="/chats/$chatId" params={{ chatId: approval.chatId }} />}
										>
											Review in chat
										</Button>
									</ApprovalCard>
								) : (
									<ApprovalBlock
										approval={approval}
										onDecide={(answer) => decide(approval.id, answer)}
										className={className}
									>
										{chatLink(approval)}
									</ApprovalBlock>
								)}
							</li>
						);
					})}
				</ul>
			)}
			{/* The history is a plain list: many entries of the same kind read better as rows than as cards. */}
			<ul className="divide-y divide-line">
				{approvals.map(
					(approval) =>
						approval.decision !== undefined && (
							<li key={approval.id} className="py-0.5">
								<DecidedRow approval={approval} decision={approval.decision}>
									{chatLink(approval)}
								</DecidedRow>
							</li>
						),
				)}
			</ul>
			{/* This panel renders twice, as the pane and as the phone sheet. Only the one in use holds the dialog. */}
			{isSheet === isPhone && <ApprovalDialog />}
		</div>
	);
}
