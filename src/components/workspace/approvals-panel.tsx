import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link, useLoaderData, useNavigate, useParams, useRouter, useSearch } from "@tanstack/react-router";
import { cn } from "cn";
import { type ReactNode, Suspense, use } from "react";
import { ApprovalBlock, ApprovalCard, ApprovalCode } from "@/components/chat/approval-block";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { formatWhen } from "@/lib/format-when";
import { ayoExecuteParts } from "@/protocol";
import { type Approval, type DecidedApproval, decideApproval, getDecidedApproval } from "@/workspace-data";
import type { WorkspaceSearch } from "@/routes/__root";
import { useIsPhone } from "./panels";

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

/** The full request of a decided approval, under its row: the code Oladayo read, or the options with his choice marked. */
function ApprovalDetail({ callId }: { callId: string }) {
	const approval = use(loadApproval(callId));
	if (!approval) return <p className="text-[0.85rem] text-ink-soft">This approval could not be loaded.</p>;
	if (approval.code) return <ApprovalCode {...ayoExecuteParts(approval.code)} />;

	return (
		<>
			{approval.detail && <p className="text-[0.85rem] leading-snug whitespace-pre-wrap text-ink-soft">{approval.detail}</p>}
			<ul className="grid gap-1" aria-label="Options">
				{approval.options.map((option) => {
					const isChosen = option === approval.decision;
					return (
						<li
							key={option}
							className={cn(
								"flex items-center gap-3 rounded px-2.5 py-1.5 text-[0.88rem]",
								isChosen ? "bg-wash-strong font-medium" : "border border-line text-ink-soft",
							)}
						>
							<span className="min-w-0 flex-1">{option}</span>
							{isChosen && <span className="shrink-0 text-[0.75rem] font-normal text-ink-soft">Your choice</span>}
						</li>
					);
				})}
			</ul>
		</>
	);
}

/**
 * A decided approval as one row of the history; it opens the full request under itself. A question
 * shows what was asked and the answer. A code approval shows what the code calls in Ayo, because its
 * question is always the same, and names the answer only when the code did not run. The open row is
 * a search param, so a reload keeps it open; one row is open at a time.
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
	const isOpen = useSearch({ from: "__root__", select: (search) => search.approval === approval.id });
	const navigate = useNavigate();
	const lineCount = approval.codeLineCount;
	const isCode = lineCount !== undefined;
	const calls = approval.codeCalls ?? [];
	const ran = isCode && decision === approval.options[0];

	function toggle() {
		// A load that failed must not stay, and a load is small, so each opening starts a new one.
		if (!isOpen) approvalLoads.delete(approval.id);
		void navigate({
			to: ".",
			search: (previous) => ({ ...previous, approval: isOpen ? undefined : approval.id }),
			replace: true,
		});
	}

	return (
		<div className="grid text-[0.9rem]">
			<button
				type="button"
				aria-expanded={isOpen}
				onClick={toggle}
				className="grid cursor-pointer gap-0.5 rounded px-2 py-2 text-left transition-colors hover:bg-wash touch:min-h-11"
			>
				<span className="flex items-baseline justify-between gap-3">
					{isCode ? (
						<span className="min-w-0 leading-snug font-medium [overflow-wrap:anywhere]">
							{calls.length > 0 ? calls.join(", ") : "Code in Ayo"}
						</span>
					) : (
						<span className="min-w-0 leading-snug font-medium">{approval.question}</span>
					)}
					<span className="flex shrink-0 items-center gap-1 text-[0.8rem] text-ink-faint">
						{approval.decidedAt !== undefined && formatWhen(approval.decidedAt)}
						<HugeiconsIcon
							icon={ArrowDown01Icon}
							size={14}
							strokeWidth={1.75}
							className={cn("transition-transform", isOpen && "rotate-180")}
						/>
					</span>
				</span>
				<span className="text-[0.82rem] text-ink-soft [overflow-wrap:anywhere]">
					{isCode && `${lineCount} ${lineCount === 1 ? "line" : "lines"}`}
					{isCode && !ran && ", not run: "}
					{(!isCode || !ran) && choiceText(approval.options, decision)}
				</span>
			</button>
			{isOpen && (
				<div className="grid gap-2 px-2 pt-1 pb-2.5">
					<Suspense fallback={<p className="text-[0.85rem] text-ink-soft">Loading…</p>}>
						<ApprovalDetail callId={approval.id} />
					</Suspense>
				</div>
			)}
			{children && <div className="flex min-w-0 px-2 pb-2">{children}</div>}
		</div>
	);
}

// A link to a chat also closes the sheet, which would otherwise stay over the chat.
function closesSheet(previous: WorkspaceSearch): WorkspaceSearch {
	return { ...previous, right: undefined };
}

/**
 * The approvals sheet: what Phoebe asked and what Oladayo chose. An open chat shows its own approvals;
 * every other page shows those of all chats, each with a link to its chat.
 */
export function ApprovalsPanel() {
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
					search={closesSheet}
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
			<SheetTitle className={cn(heading, isPhone && "text-center")}>Approvals</SheetTitle>
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
											render={<Link to="/chats/$chatId" params={{ chatId: approval.chatId }} search={closesSheet} />}
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
		</div>
	);
}
