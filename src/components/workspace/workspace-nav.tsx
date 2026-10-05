import {
	Brain01Icon,
	Calendar03Icon,
	GitBranchIcon,
	Home01Icon,
	Plug01Icon,
	PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Link, useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import { cn } from "cn";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { type ConnectionStatus, usePiSession } from "@/pi-session";
import type { WorkspaceSearch } from "@/routes/__root";
import { createChat } from "@/workspace-data";
import { type ChatTreeRow, chatTree } from "./chat-tree";
import { ThemeToggle } from "./theme-toggle";

const navRowClass =
	"flex w-full min-w-0 items-center rounded px-[0.7rem] " +
	"hover:bg-wash data-[status=active]:bg-wash-strong touch:min-h-11 [&_svg]:text-ink-soft";

const sectionLinkClass = `${navRowClass} gap-2.5 py-[0.42rem] text-[0.92rem] font-medium text-ink`;

// A step smaller and tighter than a section link, so the chat list reads as a list under the sections.
// The open chat differs only in ink strength: no surface, so the list stays quiet.
const chatLinkClass =
	"flex w-full min-w-0 items-center gap-1.5 rounded px-[0.7rem] py-[0.3rem] text-[0.86rem] text-ink-soft " +
	"transition-colors hover:text-ink data-[status=active]:text-ink touch:min-h-11 [&_svg]:text-ink-faint";

const SECTIONS: { to: "/" | "/routines" | "/memory" | "/connections"; label: string; icon: IconSvgElement }[] = [
	{ to: "/", label: "Today", icon: Home01Icon },
	{ to: "/routines", label: "Routines", icon: Calendar03Icon },
	{ to: "/memory", label: "Memory", icon: Brain01Icon },
	{ to: "/connections", label: "Connections", icon: Plug01Icon },
];

const STATUS_LABELS: Record<ConnectionStatus, string> = {
	connecting: "Connecting…",
	open: "Connected",
	closed: "Reconnecting…",
};

const STATUS_DOTS: Record<ConnectionStatus, string> = {
	connecting: "bg-star",
	open: "bg-accent",
	closed: "bg-danger",
};

// In the phone drawer a link also closes the drawer; elsewhere the panels keep their state.
function linkSearch(closesDrawer: boolean) {
	return closesDrawer ? (previous: WorkspaceSearch) => ({ ...previous, left: undefined }) : true;
}

// Where a root title starts, in rem: the left edge of the section icons.
const CHAT_INDENT = 0.7;

// How far one level of branches sits to the right of its parent, in rem.
const BRANCH_INDENT = 0.9;

/** One chat in the tree. A branch sits right of its parent, behind one guide line per level. */
export function ChatLink({ row, closesDrawer = false }: { row: ChatTreeRow; closesDrawer?: boolean }) {
	const { chat, depth } = row;
	// Only the open chat has a socket, so only it can show a run.
	const isRunning = usePiSession((state) => state.chatId === chat.id && state.running);
	return (
		<div className="relative min-w-0">
			{Array.from({ length: depth }, (_, level) => (
				<span
					key={level}
					// The line starts in the gap above the row, so it reads as one line down the group.
					className="absolute -top-0.5 bottom-0 w-px bg-line"
					style={{ left: `${CHAT_INDENT + 0.25 + level * BRANCH_INDENT}rem` }}
					aria-hidden="true"
				/>
			))}
			<Link
				to="/chats/$chatId"
				params={{ chatId: chat.id }}
				search={linkSearch(closesDrawer)}
				className={chatLinkClass}
				style={{ paddingLeft: `${CHAT_INDENT + depth * BRANCH_INDENT + (depth > 0 ? 0.65 : 0)}rem` }}
			>
				{depth > 0 && (
					<>
						<HugeiconsIcon icon={GitBranchIcon} size={14} strokeWidth={1.5} className="shrink-0" />
						<span className="sr-only">Branch: </span>
					</>
				)}
				<span className="min-w-0 truncate">{chat.title}</span>
				{isRunning && (
					<>
						<span className="ml-1 size-1.5 shrink-0 animate-stamp rounded-full bg-primary" aria-hidden="true" />
						<span className="sr-only">, working</span>
					</>
				)}
			</Link>
		</div>
	);
}

const statusItemClass = "flex items-center gap-1.5 whitespace-nowrap";

/** The left pane: where you are. The same content fills the phone drawer. */
export function WorkspaceNav({ closesDrawer = false }: { closesDrawer?: boolean }) {
	const chats = useLoaderData({ from: "__root__", select: (data) => data.chats });
	const isAyoConnected = useLoaderData({ from: "__root__", select: (data) => data.isAyoConnected });
	// The connection status belongs to the open chat's socket.
	const status = usePiSession((state) => (state.chatId === undefined ? undefined : state.status));
	const router = useRouter();
	const navigate = useNavigate();

	// A second tap while the first one runs would make a second chat, and chats cannot be deleted yet.
	const [isStartingChat, setIsStartingChat] = useState(false);

	async function startChat() {
		if (isStartingChat) return;
		setIsStartingChat(true);
		try {
			const chat = await createChat();
			await router.invalidate();
			await navigate({ to: "/chats/$chatId", params: { chatId: chat.id }, search: linkSearch(closesDrawer) });
		} catch (error) {
			console.error("Cannot create chat", error);
			toast.add({ title: "Could not start a chat", description: "Try again in a moment." });
		} finally {
			setIsStartingChat(false);
		}
	}

	return (
		<nav aria-label="Workspace" className="flex h-full flex-col gap-5">
			<div className="grid gap-0.5">
				{SECTIONS.map((section) => (
					<Link
						key={section.label}
						to={section.to}
						search={linkSearch(closesDrawer)}
						activeOptions={{ exact: true }}
						className={sectionLinkClass}
					>
						<HugeiconsIcon icon={section.icon} size={18} strokeWidth={1.5} />
						{section.label}
						{section.to === "/connections" && !isAyoConnected && (
							<>
								<span className="ml-auto size-1.5 shrink-0 rounded-full bg-star" aria-hidden="true" />
								<span className="sr-only">, needs you</span>
							</>
						)}
					</Link>
				))}
			</div>
			<div className="grid gap-0.5">
				{/* The new-chat button sits by the heading, so it needs no scrolling when the list is long. */}
				<div className="mb-1.5 flex items-center justify-between pr-1">
					<Link
						to="/chats"
						search={linkSearch(closesDrawer)}
						activeOptions={{ exact: true }}
						className="flex items-center rounded px-[0.7rem] py-1 text-[0.8rem] font-semibold text-ink-faint hover:text-ink-soft touch:min-h-11"
					>
						Chats
					</Link>
					<Button variant="quiet" className="h-7 px-2.5 text-[12.5px] touch:h-10" disabled={isStartingChat} onClick={startChat}>
						<HugeiconsIcon icon={PlusSignIcon} size={16} strokeWidth={1.75} />
						New chat
					</Button>
				</div>
				{chatTree(chats).map((row) => (
					<ChatLink key={row.chat.id} row={row} closesDrawer={closesDrawer} />
				))}
			</div>
			<div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
				<div className="flex min-w-0 items-center pl-[0.7rem] text-[0.8rem] text-ink-soft">
					<p
						className={statusItemClass}
						role="status"
						title={status && `Phoebe: ${STATUS_LABELS[status]}`}
					>
						{status && (
							<>
								<span
									className={cn("size-[0.45rem] shrink-0 rounded-full", STATUS_DOTS[status])}
									aria-hidden="true"
								/>
								{status === "open" ? (
									<>
										Phoebe<span className="sr-only"> connected</span>
									</>
								) : (
									<>
										<span className="sr-only">Phoebe: </span>
										{STATUS_LABELS[status]}
									</>
								)}
							</>
						)}
					</p>
				</div>
				<ThemeToggle />
			</div>
		</nav>
	);
}
