import { BubbleChatIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute, Link, useLoaderData, useRouter } from "@tanstack/react-router";
import { cn } from "cn";
import type { ReactNode } from "react";
import type { TodayEvent } from "@/agent";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { DeskIcon } from "@/components/workspace/desk-icon";
import { PageHeader } from "@/components/workspace/page-header";
import { TIME_ZONE } from "@/lib/format-when";
import { decideApproval, getToday } from "@/workspace-data";

export const Route = createFileRoute("/")({
	staticData: { section: "Today" },
	// The time comes with the data, so the server render and the hydrating client agree on what "today" and "12 min" are.
	loader: async () => ({ events: await getToday(), now: Date.now() }),
	component: TodayPage,
});

// A fixed locale and zone throughout: the server render and the client must write the same text.
function dayKey(epochMilliseconds: number): string {
	return new Date(epochMilliseconds).toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

/** "Wednesday, 7 October". In two parts, because the separator of one format differs between browsers. */
function dayName(epochMilliseconds: number): string {
	const date = new Date(epochMilliseconds);
	const weekday = date.toLocaleDateString("en-GB", { timeZone: TIME_ZONE, weekday: "long" });
	return `${weekday}, ${date.toLocaleDateString("en-GB", { timeZone: TIME_ZONE, day: "numeric", month: "long" })}`;
}

function clockTime(epochMilliseconds: number): string {
	return new Date(epochMilliseconds).toLocaleTimeString("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
}

/** How long a question waits: "now", "12 min", "3 h", then the date. */
function waitingTime(at: number, now: number): string {
	const minutes = Math.floor((now - at) / 60_000);
	if (minutes < 1) return "now";
	if (minutes < 60) return `${minutes} min`;
	if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h`;
	return new Date(at).toLocaleDateString("en-GB", { timeZone: TIME_ZONE, day: "numeric", month: "short" });
}

type Group = { readonly label: string; readonly events: TodayEvent[] };

/** "Now" holds the questions that wait, of any age. Then the days, newest first: "Earlier" is today. */
function groupEvents(events: readonly TodayEvent[], now: number): Group[] {
	const today = dayKey(now);
	const [year, month, day] = today.split("-").map(Number);
	const yesterday = new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
	function dayLabel(at: number): string {
		const key = dayKey(at);
		if (key === today) return "Earlier";
		if (key === yesterday) return "Yesterday";
		return dayName(at);
	}
	const eventsByLabel = new Map<string, TodayEvent[]>();
	const waiting = events.filter((event) => event.kind === "approval_opened");
	if (waiting.length > 0) eventsByLabel.set("Now", waiting);
	for (const event of events) {
		if (event.kind === "approval_opened") continue;
		const label = dayLabel(event.at);
		const group = eventsByLabel.get(label);
		if (group) group.push(event);
		else eventsByLabel.set(label, [event]);
	}
	return Array.from(eventsByLabel, ([label, labelEvents]) => ({ label, events: labelEvents }));
}

function TodayPage() {
	const { events, now } = Route.useLoaderData();
	const groups = groupEvents(events, now);
	const hasToday = events.some((event) => event.kind === "approval_opened" || dayKey(event.at) === dayKey(now));
	return (
		<>
			<PageHeader title="Today" status={<p className="shrink-0 text-[13px] text-ink-soft">{dayName(now)}</p>} />
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="mx-auto w-full max-w-[44rem] px-6 pt-6 pb-8 max-wide:px-4 max-wide:pt-4">
					{!hasToday && <p className="text-ink-soft">Nothing happened yet today.</p>}
					{groups.map((group, index) => (
						<section
							key={group.label}
							className={cn((index > 0 || !hasToday) && "mt-[1.1rem] border-t border-line pt-[1.1rem]")}
						>
							<h2 className="mb-[0.35rem] text-[13px] font-normal text-ink-soft">{group.label}</h2>
							<ul>
								{group.events.map((event) => (
									<EventRow key={event.id} event={event} now={now} />
								))}
							</ul>
						</section>
					))}
				</div>
			</div>
		</>
	);
}

const whereLink = "mr-2.5 font-medium text-ink underline-offset-[3px] hover:underline";

function EventRow({ event, now }: { event: TodayEvent; now: number }) {
	const chats = useLoaderData({ from: "__root__", select: (data) => data.chats });
	const desks = useLoaderData({ from: "__root__", select: (data) => data.desks });
	const router = useRouter();
	// A session that is no chat asks too: a subagent's.
	const chat = chats.find((candidate) => candidate.id === event.sessionId);
	// An approval names only its chat, so the desk is the one the chat has now.
	const deskId = event.deskId ?? chat?.deskId;
	const desk = desks.find((candidate) => candidate.id === deskId);
	const waits = event.kind === "approval_opened";
	const { approval } = event;

	// Not through a chat socket: no chat is open here.
	async function decide(answer: string) {
		if (event.callId === null) return;
		try {
			await decideApproval({ data: { callId: event.callId, answer } });
		} catch (error) {
			console.error("Cannot send the answer", error);
			toast.add({ title: "Could not send your answer", description: "Try again in a moment." });
		}
		// Also after a failure: the question may be gone already.
		await router.invalidate();
	}

	// Where it happened: the desk, else the chat, else a session that is no chat.
	let where = <span className={whereLink}>Phoebe</span>;
	if (desk) {
		where = (
			<Link to="/desks/$deskId" params={{ deskId: desk.id }} search className={whereLink}>
				{desk.name}
			</Link>
		);
	} else if (chat) {
		where = (
			<Link to="/chats/$chatId" params={{ chatId: chat.id }} search className={whereLink}>
				{chat.title}
			</Link>
		);
	}

	function text(): ReactNode {
		switch (event.kind) {
			case "desk_created":
				return "Created the desk";
			case "brief_changed":
				return "Changed the brief";
			case "note_added":
				return `Note: ${event.text}`;
			case "chat_started": {
				// Outside a desk the chat's title leads the row, so the row does not repeat it.
				if (!desk) return "started";
				const started = `Started “${event.text}”`;
				if (!chat) return started;
				return (
					<Link to="/chats/$chatId" params={{ chatId: chat.id }} search className="underline-offset-[3px] hover:underline">
						{started}
					</Link>
				);
			}
			case "approval_opened":
				return event.text;
			case "approval_decided": {
				// His own words go in quotation marks, an option as Phoebe wrote it.
				const answer = approval?.options.includes(event.text) ? event.text : `“${event.text}”`;
				return approval ? `${approval.question} · ${answer}` : answer;
			}
		}
	}

	return (
		<li className="flex items-baseline gap-3 py-[0.35rem]">
			<span className="mt-[3px] flex shrink-0 self-start text-ink-faint">
				{desk ? (
					<DeskIcon icon={desk.icon} hue={desk.hue} size={16} />
				) : (
					<HugeiconsIcon icon={BubbleChatIcon} size={16} strokeWidth={1.5} aria-hidden="true" />
				)}
			</span>
			<div className="min-w-0 flex-1">
				<p className={cn("wide:truncate", waits ? "text-ink" : "text-ink-soft")}>
					{where}
					{text()}
				</p>
				{waits && approval && (
					<div className="mt-[0.4rem] mb-1 flex flex-wrap gap-1.5">
						{/* Without a chat to read the detail in, the options are all he can get here. */}
						{(!approval.hasMoreToRead || !chat) &&
							approval.options.map((option) => (
								<Button key={option} variant="quiet" className="h-7 px-3" onClick={() => decide(option)}>
									{option}
								</Button>
							))}
						{/* The detail or the code is in the chat, and Oladayo must read it before he answers. */}
						{approval.hasMoreToRead && chat && (
							<Button
								variant="quiet"
								className="h-7 px-3"
								nativeButton={false}
								render={<Link to="/chats/$chatId" params={{ chatId: chat.id }} search />}
							>
								Review in chat
							</Button>
						)}
					</div>
				)}
			</div>
			<time dateTime={new Date(event.at).toISOString()} className="shrink-0 text-right text-[13px] text-ink-faint">
				{waits ? waitingTime(event.at, now) : clockTime(event.at)}
			</time>
		</li>
	);
}
