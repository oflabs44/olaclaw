import {
	Brain01Icon,
	Calendar03Icon,
	GitBranchIcon,
	Home01Icon,
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

const navLinkClass =
	"flex w-full min-w-0 items-center gap-2.5 rounded px-[0.7rem] py-[0.42rem] text-[0.92rem] font-medium text-ink " +
	"hover:bg-wash data-[status=active]:bg-wash-strong touch:min-h-11 [&_svg]:text-ink-soft";

const SECTIONS: { to: "/" | "/routines" | "/memory"; label: string; icon: IconSvgElement }[] = [
	{ to: "/", label: "Today", icon: Home01Icon },
	{ to: "/routines", label: "Routines", icon: Calendar03Icon },
	{ to: "/memory", label: "Memory", icon: Brain01Icon },
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

// How far one level of branches sits to the right of its parent, in rem.
const BRANCH_INDENT = 0.9;

/**
 * One chat in the tree. A branch sits right of its parent, behind one guide line per level.
 * `indent` is where a root title starts, in rem: in the nav, under the section labels.
 */
export function ChatLink({
	row,
	indent = 2.35,
	closesDrawer = false,
}: { row: ChatTreeRow; indent?: number; closesDrawer?: boolean }) {
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
					style={{ left: `${indent + 0.25 + level * BRANCH_INDENT}rem` }}
					aria-hidden="true"
				/>
			))}
			<Link
				to="/chats/$chatId"
				params={{ chatId: chat.id }}
				search={linkSearch(closesDrawer)}
				className={cn(navLinkClass, "gap-1.5 font-normal text-ink-soft data-[status=active]:text-ink")}
				style={{ paddingLeft: `${indent + depth * BRANCH_INDENT + (depth > 0 ? 0.65 : 0)}rem` }}
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

/** The left pane: where you are. The same content fills the phone drawer. */
export function WorkspaceNav({ closesDrawer = false }: { closesDrawer?: boolean }) {
	const chats = useLoaderData({ from: "__root__", select: (data) => data.chats });
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
						className={navLinkClass}
					>
						<HugeiconsIcon icon={section.icon} size={18} strokeWidth={1.5} />
						{section.label}
					</Link>
				))}
			</div>
			<div className="grid gap-0.5">
				<Link
					to="/chats"
					search={linkSearch(closesDrawer)}
					activeOptions={{ exact: true }}
					className="rounded px-[0.7rem] py-1 text-[0.8rem] font-semibold text-ink-faint hover:text-ink-soft"
				>
					Chats
				</Link>
				{chatTree(chats).map((row) => (
					<ChatLink key={row.chat.id} row={row} closesDrawer={closesDrawer} />
				))}
			</div>
			<Button
				variant="quiet"
				className="mx-1.5"
				disabled={isStartingChat}
				onClick={startChat}
			>
				<HugeiconsIcon icon={PlusSignIcon} size={18} strokeWidth={1.5} />
				New chat
			</Button>
			<div className="mt-auto flex items-center justify-between px-2">
				<p className="flex items-center gap-2 text-[0.85rem] text-ink-soft" role="status">
					{status && (
						<>
							<span className={cn("size-[0.45rem] rounded-full", STATUS_DOTS[status])} aria-hidden="true" />
							{STATUS_LABELS[status]}
						</>
					)}
				</p>
				<ThemeToggle />
			</div>
		</nav>
	);
}
