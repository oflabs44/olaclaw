import {
	ArrowLeft01Icon,
	Brain01Icon,
	Calendar03Icon,
	GitBranchIcon,
	Home01Icon,
	Notebook01Icon,
	NoteIcon,
	Plug01Icon,
	PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Link, useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import { cn } from "cn";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { Desk } from "@/desks";
import { type ConnectionStatus, usePiSession } from "@/pi-session";
import type { WorkspaceSearch } from "@/routes/__root";
import { createChat } from "@/workspace-data";
import { type ChatTreeRow, chatTree } from "./chat-tree";
import { useActiveDesk } from "./current-place";
import { DeskIcon, DeskTile } from "./desk-icon";
import { ThemeToggle } from "./theme-toggle";

const navRowClass =
	"flex w-full min-w-0 items-center rounded px-[0.7rem] " +
	"hover:bg-wash data-[status=active]:bg-wash-strong touch:min-h-11 [&_svg]:text-ink-soft";

const sectionLinkClass = `${navRowClass} gap-2.5 py-[0.42rem] text-[0.92rem] font-medium text-ink`;

const groupHeadingClass = "px-[0.7rem] py-1 text-[0.8rem] font-semibold text-ink-faint";

// A group's action sits by its heading, so it needs no scrolling when the list is long.
const groupActionClass = "h-7 px-2.5 text-[12.5px] touch:h-10";

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

const DESK_PAGES: { to: "/desks/$deskId/brief" | "/desks/$deskId/notebook"; label: string; icon: IconSvgElement }[] = [
	{ to: "/desks/$deskId/brief", label: "Brief", icon: NoteIcon },
	{ to: "/desks/$deskId/notebook", label: "Notebook", icon: Notebook01Icon },
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
	// The approvals pane of an open chat shows only that chat, so the row says when another chat waits.
	const needsYou = useLoaderData({
		from: "__root__",
		select: (data) =>
			data.approvals.some((approval) => approval.chatId === chat.id && approval.decision === undefined),
	});
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
				{needsYou && (
					<>
						<span className="ml-auto size-1.5 shrink-0 rounded-full bg-star" aria-hidden="true" />
						<span className="sr-only">, needs you</span>
					</>
				)}
			</Link>
		</div>
	);
}

/** The desks, each in its own colour. A dot says that a chat at the desk waits for an answer. */
function DeskLinks({ closesDrawer }: { closesDrawer: boolean }) {
	const desks = useLoaderData({ from: "__root__", select: (data) => data.desks });
	const chats = useLoaderData({ from: "__root__", select: (data) => data.chats });
	const approvals = useLoaderData({ from: "__root__", select: (data) => data.approvals });
	const waitingChatIds = new Set(
		approvals.filter((approval) => approval.decision === undefined).map((approval) => approval.chatId),
	);
	return (
		<div className="grid gap-0.5">
			<div className="mb-1.5 flex items-center justify-between pr-1">
				<p className={groupHeadingClass}>Desks</p>
				<Button
					variant="quiet"
					className={groupActionClass}
					nativeButton={false}
					render={<Link to="/desks/new" search={linkSearch(closesDrawer)} />}
				>
					<HugeiconsIcon icon={PlusSignIcon} size={16} strokeWidth={1.75} />
					New desk
				</Button>
			</div>
			{desks.map((desk) => (
				<Link
					key={desk.id}
					to="/desks/$deskId"
					params={{ deskId: desk.id }}
					search={linkSearch(closesDrawer)}
					// Not `sectionLinkClass`: that one paints every icon in soft ink.
					className="flex w-full min-w-0 items-center gap-2.5 rounded px-[0.7rem] py-[0.42rem] text-[0.92rem] font-medium text-ink hover:bg-wash touch:min-h-11"
				>
					<DeskIcon icon={desk.icon} hue={desk.hue} />
					<span className="min-w-0 truncate">{desk.name}</span>
					{chats.some((chat) => chat.deskId === desk.id && waitingChatIds.has(chat.id)) && (
						<>
							<span className="ml-auto size-1.5 shrink-0 rounded-full bg-star" aria-hidden="true" />
							<span className="sr-only">, needs you</span>
						</>
					)}
				</Link>
			))}
		</div>
	);
}

/** The workspace outside the desks: the sections, the desks, and the chats that belong to no desk. */
function HomeNav({ closesDrawer }: { closesDrawer: boolean }) {
	const chats = useLoaderData({ from: "__root__", select: (data) => data.chats });
	const isAyoConnected = useLoaderData({ from: "__root__", select: (data) => data.isAyoConnected });
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
		<>
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
			<DeskLinks closesDrawer={closesDrawer} />
			<div className="grid gap-0.5">
				<div className="mb-1.5 flex items-center justify-between pr-1">
					<Link
						to="/chats"
						search={linkSearch(closesDrawer)}
						activeOptions={{ exact: true }}
						className={`flex items-center rounded hover:text-ink-soft touch:min-h-11 ${groupHeadingClass}`}
					>
						Chats
					</Link>
					<Button variant="quiet" className={groupActionClass} disabled={isStartingChat} onClick={startChat}>
						<HugeiconsIcon icon={PlusSignIcon} size={16} strokeWidth={1.75} />
						New chat
					</Button>
				</div>
				{chatTree(chats.filter((chat) => chat.deskId === null)).map((row) => (
					<ChatLink key={row.chat.id} row={row} closesDrawer={closesDrawer} />
				))}
			</div>
		</>
	);
}

/** The workspace inside a desk: the way out, the desk's own pages, and only its chats. */
function DeskNav({ desk, closesDrawer }: { desk: Desk; closesDrawer: boolean }) {
	const chats = useLoaderData({ from: "__root__", select: (data) => data.chats });
	return (
		<>
			<div className="grid gap-3">
				<Link
					to="/"
					search={linkSearch(closesDrawer)}
					className="flex w-fit items-center gap-1 rounded px-[0.45rem] py-1 text-[0.8rem] font-medium text-ink-soft hover:text-ink touch:min-h-11"
				>
					<HugeiconsIcon icon={ArrowLeft01Icon} size={15} strokeWidth={1.75} />
					Phoebe
				</Link>
				<Link
					to="/desks/$deskId"
					params={{ deskId: desk.id }}
					search={linkSearch(closesDrawer)}
					className="flex min-w-0 items-center gap-2.5 rounded px-[0.7rem] py-1 touch:min-h-11"
				>
					<DeskTile icon={desk.icon} hue={desk.hue} size={17} className="size-7 rounded-[8px]" />
					<span className="min-w-0 truncate text-lg font-semibold">{desk.name}</span>
				</Link>
			</div>
			<div className="grid gap-0.5">
				{DESK_PAGES.map((page) => (
					<Link
						key={page.to}
						to={page.to}
						params={{ deskId: desk.id }}
						search={linkSearch(closesDrawer)}
						className={sectionLinkClass}
					>
						<HugeiconsIcon icon={page.icon} size={18} strokeWidth={1.5} />
						{page.label}
					</Link>
				))}
			</div>
			<div className="grid gap-0.5">
				<div className="mb-1.5 flex items-center justify-between pr-1">
					<p className={groupHeadingClass}>Chats</p>
					{/* A chat at a desk starts from the desk's home, with its first message. */}
					<Button
						variant="quiet"
						className={groupActionClass}
						nativeButton={false}
						render={<Link to="/desks/$deskId" params={{ deskId: desk.id }} search={linkSearch(closesDrawer)} />}
					>
						<HugeiconsIcon icon={PlusSignIcon} size={16} strokeWidth={1.75} />
						New chat
					</Button>
				</div>
				{chatTree(chats.filter((chat) => chat.deskId === desk.id)).map((row) => (
					<ChatLink key={row.chat.id} row={row} closesDrawer={closesDrawer} />
				))}
			</div>
		</>
	);
}

const statusItemClass = "flex items-center gap-1.5 whitespace-nowrap";

/** The left pane: where you are. The same content fills the phone drawer. Inside a desk it is the desk's own. */
export function WorkspaceNav({ closesDrawer = false }: { closesDrawer?: boolean }) {
	const desk = useActiveDesk();
	return (
		<nav aria-label={desk ? desk.name : "Workspace"} className="flex h-full flex-col gap-5">
			{desk ? <DeskNav desk={desk} closesDrawer={closesDrawer} /> : <HomeNav closesDrawer={closesDrawer} />}
			<NavFooter closesDrawer={closesDrawer} />
		</nav>
	);
}

function NavFooter({ closesDrawer }: { closesDrawer: boolean }) {
	// The connection status belongs to the open chat's socket.
	const status = usePiSession((state) => (state.chatId === undefined ? undefined : state.status));
	return (
		// The line runs to the edges of the pane or drawer, through their side padding.
		<div
			className={cn(
				"mt-auto flex items-center justify-between gap-2 border-t border-line pt-3",
				closesDrawer ? "-mx-3 px-3" : "-mx-1.5 px-1.5",
			)}
		>
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
	);
}
