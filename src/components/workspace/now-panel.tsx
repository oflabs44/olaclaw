import {
	Activity01Icon,
	CheckmarkCircle02Icon,
	Clock01Icon,
	Mail01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { useLoaderData } from "@tanstack/react-router";
import { cn } from "cn";
import type { ReactNode } from "react";
import { ApprovalBlock } from "@/components/chat/approval-block";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { SheetTitle } from "@/components/ui/sheet";
import { usePiSession } from "@/pi-session";
import type { ScheduledItem } from "@/workspace-data";
import { useOpenChatTitle } from "./current-place";

function Section({ title, icon, children }: { title: string; icon: IconSvgElement; children: ReactNode }) {
	return (
		<section className="rounded border border-line bg-sheet px-1.5 pt-2.5 pb-1">
			<h3 className="flex items-center gap-2 px-2 pb-1.5 text-[0.8rem] font-semibold text-ink-faint">
				<HugeiconsIcon icon={icon} size={16} strokeWidth={1.5} />
				{title}
			</h3>
			{children}
		</section>
	);
}

function SectionEmpty({ children }: { children: ReactNode }) {
	return (
		<Empty className="items-start p-0 px-2 pb-2 text-left">
			<EmptyDescription className="text-[0.9rem]">{children}</EmptyDescription>
		</Empty>
	);
}

const itemClass = "grid gap-px px-2 py-1.5 text-[0.9rem] touch:py-2.5";

function ScheduledList({ items, empty }: { items: readonly ScheduledItem[]; empty: string }) {
	if (items.length === 0) return <SectionEmpty>{empty}</SectionEmpty>;
	return (
		<ul className="divide-y divide-line">
			{items.map((item) => (
				<li key={item.id} className={itemClass}>
					{item.title}
					<small className="text-[0.82rem] text-ink-soft">{item.when}</small>
				</li>
			))}
		</ul>
	);
}

function Pulse() {
	return <span className="size-[0.4rem] shrink-0 animate-stamp rounded-full bg-primary" aria-hidden="true" />;
}

function WorkingSection() {
	const background = useLoaderData({ from: "__root__", select: (data) => data.now.working });
	const isRunning = usePiSession((state) => state.running);
	const runningToolName = usePiSession((state) => state.tools.at(-1)?.name);
	const chatTitle = useOpenChatTitle();

	if (!isRunning && background.length === 0) return <SectionEmpty>Idle</SectionEmpty>;
	return (
		<ul className="divide-y divide-line" aria-live="polite">
			{isRunning && (
				<li className={itemClass}>
					<span className="flex min-w-0 items-center gap-2">
						<Pulse />
						<span className="truncate">{chatTitle ? `Answering in “${chatTitle}”` : "Answering"}</span>
					</span>
					<small className="text-[0.82rem] text-ink-soft">
						{runningToolName ? `Running ${runningToolName}` : "Writing"}
					</small>
				</li>
			)}
			{background.map((work) => (
				<li key={work.id} className={itemClass}>
					<span className="flex items-center gap-2">
						<Pulse />
						{work.title}
					</span>
					<small className="text-[0.82rem] text-ink-soft">{work.detail}</small>
				</li>
			))}
		</ul>
	);
}

/** The right pane: what the assistant does without you. */
export function NowPanel({ isSheet = false }: { isSheet?: boolean }) {
	const now = useLoaderData({ from: "__root__", select: (data) => data.now });
	const heading = "px-2 py-1 text-[0.95rem] font-semibold";

	return (
		<div className="flex flex-col gap-4">
			{isSheet ? (
				<SheetTitle className={cn(heading, "text-center")}>Now</SheetTitle>
			) : (
				<h2 className={heading}>Now</h2>
			)}
			<Section title="Working" icon={Activity01Icon}>
				<WorkingSection />
			</Section>
			<Section title="Needs you" icon={Mail01Icon}>
				{now.needsYou.length === 0 ? (
					<SectionEmpty>Nothing needs you</SectionEmpty>
				) : (
					<div className="grid gap-2 px-0.5 pb-1.5">
						{now.needsYou.map((approval) => (
							<ApprovalBlock key={approval.id} approval={approval} className="px-3 py-2.5 text-[0.9rem]" />
						))}
					</div>
				)}
			</Section>
			<Section title="Coming up" icon={Clock01Icon}>
				<ScheduledList items={now.comingUp} empty="No routines scheduled" />
			</Section>
			<Section title="Done today" icon={CheckmarkCircle02Icon}>
				<ScheduledList items={now.doneToday} empty="Nothing yet today" />
			</Section>
		</div>
	);
}
