import {
	ArrowDown01Icon,
	ArrowRight01Icon,
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
import { useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { Desk } from "@/desks";
import { type ConnectionStatus, usePiSession } from "@/pi-session";
import type { WorkspaceSearch } from "@/routes/__root";
import { createChat } from "@/workspace-data";
import { type ChatTreeRow, chatTree } from "./chat-tree";
import { useActiveDesk } from "./current-place";
import { restoreOpenDeskFolders, setDeskFolderOpen, useIsDeskFolderOpen } from "./desk-folders";
import { DeskIcon } from "./desk-icon";
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

// A desk's page in its folder: the size of a chat row, with the surface of a section when it is open.
const folderRowClass = `${navRowClass} gap-1.5 py-[0.3rem] text-[0.86rem] text-ink`;

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

// A folder holds its rows one level in, so a branch at a desk may go one level less deep than a
// loose one. The deepest title then starts at the same place in both.
const FOLDER_DEPTH = 1;
const FOLDER_BRANCH_DEPTH = 2;

function rowIndent(depth: number): string {
	return `${CHAT_INDENT + depth * BRANCH_INDENT + (depth > 0 ? 0.65 : 0)}rem`;
}

/** One guide line per level, behind a row that sits `depth` levels in. */
function GuideLines({ depth }: { depth: number }) {
	return Array.from({ length: depth }, (_, level) => (
		<span
			key={level}
			// The line starts in the gap above the row, so it reads as one line down the group.
			className="absolute -top-0.5 bottom-0 w-px bg-line"
			style={{ left: `${CHAT_INDENT + 0.25 + level * BRANCH_INDENT}rem` }}
			aria-hidden="true"
		/>
	));
}

/**
 * One chat in the tree. A branch sits right of its parent, behind one guide line per level.
 * `folderDepth` moves the row in by the levels of the folder that holds it.
 */
export function ChatLink({
	row,
	folderDepth = 0,
	closesDrawer = false,
}: {
	row: ChatTreeRow;
	folderDepth?: number;
	closesDrawer?: boolean;
}) {
	const { chat } = row;
	const isBranch = row.depth > 0;
	const depth = row.depth + folderDepth;
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
			<GuideLines depth={depth} />
			<Link
				to="/chats/$chatId"
				params={{ chatId: chat.id }}
				search={linkSearch(closesDrawer)}
				className={chatLinkClass}
				style={{ paddingLeft: rowIndent(depth) }}
			>
				{isBranch && (
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

/**
 * A desk as a folder: its pages and its chats, one level in. The name opens the desk's home and the
 * folder; the chevron only opens and closes the folder. The folder of the desk you are at stays open.
 */
function DeskFolder({
	desk,
	isActive,
	needsYou,
	closesDrawer,
}: {
	desk: Desk;
	isActive: boolean;
	needsYou: boolean;
	closesDrawer: boolean;
}) {
	const chats = useLoaderData({ from: "__root__", select: (data) => data.chats });
	const isOpen = useIsDeskFolderOpen(desk.id) || isActive;
	return (
		<div className="grid gap-0.5">
			<div className="flex min-w-0 items-center gap-0.5">
				<Link
					to="/desks/$deskId"
					params={{ deskId: desk.id }}
					search={linkSearch(closesDrawer)}
					activeOptions={{ exact: true }}
					onClick={() => setDeskFolderOpen(desk.id, true)}
					// Not `sectionLinkClass`: that one paints every icon in soft ink.
					className="flex min-w-0 flex-1 items-center gap-2.5 rounded px-[0.7rem] py-[0.42rem] text-[0.92rem] font-medium text-ink hover:bg-wash data-[status=active]:bg-wash-strong touch:min-h-11"
				>
					<DeskIcon icon={desk.icon} hue={desk.hue} />
					<span className="min-w-0 truncate">{desk.name}</span>
					{/* An open folder shows the dot on the chat that waits. */}
					{needsYou && !isOpen && (
						<>
							<span className="ml-auto size-1.5 shrink-0 rounded-full bg-star" aria-hidden="true" />
							<span className="sr-only">, needs you</span>
						</>
					)}
				</Link>
				<Button
					icon
					className="size-7 touch:size-11"
					aria-label={`${isOpen ? "Collapse" : "Expand"} ${desk.name}`}
					aria-expanded={isOpen}
					disabled={isActive}
					onClick={() => setDeskFolderOpen(desk.id, !isOpen)}
				>
					<HugeiconsIcon icon={isOpen ? ArrowDown01Icon : ArrowRight01Icon} size={16} strokeWidth={1.75} />
				</Button>
			</div>
			{isOpen && (
				<>
					{DESK_PAGES.map((page) => (
						<div key={page.to} className="relative min-w-0">
							<GuideLines depth={FOLDER_DEPTH} />
							<Link
								to={page.to}
								params={{ deskId: desk.id }}
								search={linkSearch(closesDrawer)}
								className={folderRowClass}
								style={{ paddingLeft: rowIndent(FOLDER_DEPTH) }}
							>
								<HugeiconsIcon icon={page.icon} size={16} strokeWidth={1.5} />
								{page.label}
							</Link>
						</div>
					))}
					{chatTree(
						chats.filter((chat) => chat.deskId === desk.id),
						FOLDER_BRANCH_DEPTH,
					).map((row) => (
						<ChatLink key={row.chat.id} row={row} folderDepth={FOLDER_DEPTH} closesDrawer={closesDrawer} />
					))}
					<div className="relative min-w-0">
						<GuideLines depth={FOLDER_DEPTH} />
						{/* A chat at a desk starts from the desk's home, with its first message. The folder row already marks that page, so this row does not. */}
						<Link
							to="/desks/$deskId"
							params={{ deskId: desk.id }}
							search={linkSearch(closesDrawer)}
							className={cn(chatLinkClass, "data-[status=active]:text-ink-soft")}
							style={{ paddingLeft: rowIndent(FOLDER_DEPTH) }}
						>
							<HugeiconsIcon icon={PlusSignIcon} size={14} strokeWidth={1.75} className="shrink-0" />
							New chat
						</Link>
					</div>
				</>
			)}
		</div>
	);
}

/** The desks, each a folder in its own colour. A dot on a closed folder says that a chat in it waits for an answer. */
function DeskFolders({ closesDrawer }: { closesDrawer: boolean }) {
	const desks = useLoaderData({ from: "__root__", select: (data) => data.desks });
	const chats = useLoaderData({ from: "__root__", select: (data) => data.chats });
	const approvals = useLoaderData({ from: "__root__", select: (data) => data.approvals });
	const activeDeskId = useActiveDesk()?.id;
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
				<DeskFolder
					key={desk.id}
					desk={desk}
					isActive={desk.id === activeDeskId}
					needsYou={chats.some((chat) => chat.deskId === desk.id && waitingChatIds.has(chat.id))}
					closesDrawer={closesDrawer}
				/>
			))}
		</div>
	);
}

/** The tree: the sections, the desks as folders, and the chats that belong to no desk. */
function NavTree({ closesDrawer }: { closesDrawer: boolean }) {
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
			<DeskFolders closesDrawer={closesDrawer} />
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

const statusItemClass = "flex items-center gap-1.5 whitespace-nowrap";

/** The left pane: where you are. The same content fills the phone drawer. */
export function WorkspaceNav({ closesDrawer = false }: { closesDrawer?: boolean }) {
	// A layout effect, so the stored folders open after hydration and before the first paint.
	useLayoutEffect(restoreOpenDeskFolders, []);
	return (
		<nav aria-label="Workspace" className="flex h-full flex-col gap-5">
			<NavTree closesDrawer={closesDrawer} />
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
