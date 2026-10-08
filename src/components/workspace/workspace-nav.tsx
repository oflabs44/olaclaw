import { ArrowDown01Icon, ArrowRight01Icon, GitBranchIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link, type LinkProps, useLoaderData } from "@tanstack/react-router";
import { cn } from "cn";
import { type ReactNode, useLayoutEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { type ConnectionStatus, usePiSession } from "@/pi-session";
import type { WorkspaceSearch } from "@/routes/__root";
import { type ChatTreeRow, chatTree } from "./chat-tree";
import { useActiveDeskFolder } from "./current-place";
import { restoreOpenDeskFolders, setDeskFolderOpen, useIsDeskFolderOpen } from "./desk-folders";
import { DeskIcon } from "./desk-icon";
import { GENERAL_DESK_FOLDER, GENERAL_DESK_NAME, GeneralDeskIcon } from "./general-desk";
import { ThemeToggle } from "./theme-toggle";

const rowClass =
	"flex w-full min-w-0 items-center gap-[9px] rounded-sm px-[0.7rem] py-[0.3rem] text-left text-[15px] text-ink-soft " +
	"transition-colors hover:text-ink max-wide:min-h-11 touch:min-h-11 max-wide:text-[16px]";

// One row of the tree. The open page's row takes a wash; the others differ only in ink strength.
const navRowClass = cn(rowClass, "data-[status=active]:bg-wash data-[status=active]:text-ink");

const leadRowClass = cn(navRowClass, "font-medium text-ink");

const faintRowClass = cn(navRowClass, "text-ink-faint");

// What the footer says while the open chat's socket is not connected.
const STATUS_LABELS: Record<Exclude<ConnectionStatus, "open">, string> = {
	connecting: "Connecting…",
	closed: "Reconnecting…",
};

// In the phone drawer a link also closes the drawer; elsewhere the panels keep their state.
function linkSearch(closesDrawer: boolean) {
	return closesDrawer ? (previous: WorkspaceSearch) => ({ ...previous, left: undefined }) : true;
}

// Where a root title starts: the left edge of the icon column.
const CHAT_INSET = "0.7rem";

// Where the title of a chat starts in the nav: under its desk's name, past the glyph and its gap.
const DESK_CHAT_INSET = "calc(0.7rem + 25px)";

// How far one level of branches sits to the right of its parent, in rem.
const BRANCH_INDENT = 0.9;

// In the nav a desk's chats already sit one level in, so a branch may go one level less deep there
// than on the desk's page. The deepest title then has the same room in both.
const DESK_BRANCH_DEPTH = 2;

function rowIndent(inset: string, depth: number): string {
	return `calc(${inset} + ${depth * BRANCH_INDENT + (depth > 0 ? 0.65 : 0)}rem)`;
}

/** One guide line per level, behind a branch that sits `depth` levels in. */
function GuideLines({ inset, depth }: { inset: string; depth: number }) {
	return Array.from({ length: depth }, (_, level) => (
		<span
			key={level}
			// The line starts in the gap above the row, so it reads as one line down the group.
			className="absolute -top-px bottom-0 w-px bg-line"
			style={{ left: `calc(${inset} + ${0.25 + level * BRANCH_INDENT}rem)` }}
			aria-hidden="true"
		/>
	));
}

function RunningDot() {
	return (
		<>
			<span className="ml-auto size-1.5 shrink-0 animate-stamp rounded-full bg-ink-soft" aria-hidden="true" />
			<span className="sr-only">, working</span>
		</>
	);
}

function NeedsYouDot() {
	return (
		<>
			<span className="ml-auto size-1.5 shrink-0 rounded-full bg-star" aria-hidden="true" />
			<span className="sr-only">, needs you</span>
		</>
	);
}

/**
 * One chat in the tree. A branch sits right of its parent, behind one guide line per level.
 * `inset` is where the title of a root chat starts. `trailing` sits at the right end of the row,
 * for a list that has room for more than the title.
 */
export function ChatLink({
	row,
	inset = CHAT_INSET,
	closesDrawer = false,
	trailing,
}: {
	row: ChatTreeRow;
	inset?: string;
	closesDrawer?: boolean;
	trailing?: ReactNode;
}) {
	const { chat, depth } = row;
	// Only the open chat has a socket, so only it can show a run.
	const isRunning = usePiSession((state) => state.chatId === chat.id && state.running);
	const needsYou = useLoaderData({ from: "__root__", select: (data) => data.waitingChatIds.includes(chat.id) });
	return (
		<div className="relative min-w-0">
			<GuideLines inset={inset} depth={depth} />
			<Link
				to="/chats/$chatId"
				params={{ chatId: chat.id }}
				search={linkSearch(closesDrawer)}
				className={cn(navRowClass, depth > 0 && "gap-1.5")}
				style={{ paddingLeft: rowIndent(inset, depth) }}
			>
				{depth > 0 && (
					<>
						<HugeiconsIcon icon={GitBranchIcon} size={14} strokeWidth={1.5} className="shrink-0 text-ink-faint" />
						<span className="sr-only">Branch: </span>
					</>
				)}
				{/* The title takes the free room, so what trails it stays at the right end beside a dot. */}
				<span className={cn("min-w-0 truncate", trailing !== undefined && "flex-1")}>{chat.title}</span>
				{isRunning && <RunningDot />}
				{needsYou && <NeedsYouDot />}
				{trailing}
			</Link>
		</div>
	);
}

/**
 * A desk and its chats, one level in. The name opens the desk's page and the group; the caret only
 * opens and closes the group. Every group closes, the one you are at too: entering a desk opens it once.
 * `deskId` is null for the General desk.
 */
function DeskGroup({
	deskId,
	name,
	glyph,
	closesDrawer,
}: {
	deskId: string | null;
	name: string;
	glyph: ReactNode;
	closesDrawer: boolean;
}) {
	const chats = useLoaderData({ from: "__root__", select: (data) => data.chats });
	const waitingChatIds = useLoaderData({ from: "__root__", select: (data) => data.waitingChatIds });
	const folder = deskId ?? GENERAL_DESK_FOLDER;
	const isOpen = useIsDeskFolderOpen(folder);
	const deskChats = chats.filter((chat) => chat.deskId === deskId);
	const needsYou = deskChats.some((chat) => waitingChatIds.includes(chat.id));
	const page: Pick<LinkProps, "to" | "params"> =
		deskId === null ? { to: "/chats" } : { to: "/desks/$deskId", params: { deskId } };
	return (
		<div className="grid gap-px">
			<div className="group flex min-w-0 items-center rounded-sm has-[[data-status=active]]:bg-wash">
				<Link
					{...page}
					search={linkSearch(closesDrawer)}
					activeOptions={{ exact: true }}
					onClick={() => setDeskFolderOpen(folder, true)}
					className="flex min-w-0 flex-1 items-center gap-[9px] rounded-sm px-[0.7rem] py-[0.3rem] text-[15px] font-medium max-wide:min-h-11 touch:min-h-11 max-wide:text-[16px]"
				>
					{glyph}
					<span className="min-w-0 truncate">{name}</span>
					{/* An open group shows the dot on the chat that waits. */}
					{needsYou && !isOpen && <NeedsYouDot />}
				</Link>
				{/* A chat at a desk starts on the desk page. Shown like the caret: under the pointer on wide, always on touch. */}
				<Link
					{...page}
					search={linkSearch(closesDrawer)}
					aria-label={`New chat at ${name}`}
					className="grid size-7 shrink-0 place-items-center rounded-sm text-ink-faint opacity-0 transition-[color,opacity] group-hover:opacity-100 hover:text-ink focus-visible:opacity-100 max-wide:opacity-100 touch:opacity-100 max-wide:size-11 touch:size-11"
				>
					<HugeiconsIcon icon={PlusSignIcon} size={14} strokeWidth={1.75} />
				</Link>
				{/* The caret always shows: it says whether the group is open. */}
				<button
					type="button"
					aria-label={`${isOpen ? "Collapse" : "Expand"} ${name}`}
					aria-expanded={isOpen}
					onClick={() => setDeskFolderOpen(folder, !isOpen)}
					className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-sm text-ink-faint transition-colors hover:text-ink max-wide:size-11 touch:size-11"
				>
					<HugeiconsIcon icon={isOpen ? ArrowDown01Icon : ArrowRight01Icon} size={14} strokeWidth={1.75} />
				</button>
			</div>
			{isOpen && (
				// Indent alone groups the chats under their desk.
				<div className="mb-[0.4rem] grid gap-px empty:hidden">
					{chatTree(deskChats, DESK_BRANCH_DEPTH).map((row) => (
						<ChatLink key={row.chat.id} row={row} inset={DESK_CHAT_INSET} closesDrawer={closesDrawer} />
					))}
				</div>
			)}
		</div>
	);
}

/**
 * The desks, then the General desk with the chats that belong to none, then the way to a new desk.
 * A dot on a closed desk says that a chat in it waits for an answer.
 */
function DeskGroups({ closesDrawer }: { closesDrawer: boolean }) {
	const desks = useLoaderData({ from: "__root__", select: (data) => data.desks });
	const activeFolder = useActiveDeskFolder();
	// Entering a desk opens its group, from any route into it. It can be closed again while you stay.
	useLayoutEffect(() => {
		if (activeFolder !== undefined) setDeskFolderOpen(activeFolder, true);
	}, [activeFolder]);
	return (
		<div className="grid gap-px">
			{desks.map((desk) => (
				<DeskGroup
					key={desk.id}
					deskId={desk.id}
					name={desk.name}
					glyph={<DeskIcon icon={desk.icon} hue={desk.hue} />}
					closesDrawer={closesDrawer}
				/>
			))}
			<DeskGroup deskId={null} name={GENERAL_DESK_NAME} glyph={<GeneralDeskIcon />} closesDrawer={closesDrawer} />
			<Link to="/desks/new" search={linkSearch(closesDrawer)} className={faintRowClass}>
				<HugeiconsIcon icon={PlusSignIcon} size={16} strokeWidth={1.75} className="shrink-0" />
				New desk
			</Link>
		</div>
	);
}

/** The tree: a new chat, then the desks with their chats. */
function NavTree({ closesDrawer }: { closesDrawer: boolean }) {
	return (
		<>
			<div className="grid gap-px">
				{/* On a wide screen the wordmark leads to Today; the drawer has no wordmark. */}
				{closesDrawer && (
					<Link to="/" search={linkSearch(closesDrawer)} activeOptions={{ exact: true }} className={leadRowClass}>
						Today
					</Link>
				)}
				{/* To the field on the General desk's page. No wash for the open page: the desk's own row has it. */}
				<Link to="/chats" search={linkSearch(closesDrawer)} className={cn(rowClass, "font-medium text-ink")}>
					<HugeiconsIcon icon={PlusSignIcon} size={16} strokeWidth={1.75} className="shrink-0" />
					New chat
				</Link>
			</div>
			<DeskGroups closesDrawer={closesDrawer} />
		</>
	);
}

/**
 * The left pane: where you are. The same content fills the phone drawer. The tree scrolls and the
 * footer stays, so the pane or the drawer that holds it must not scroll or pad.
 */
export function WorkspaceNav({ closesDrawer = false }: { closesDrawer?: boolean }) {
	// A layout effect, so the stored groups open after hydration and before the first paint.
	useLayoutEffect(restoreOpenDeskFolders, []);
	return (
		<nav aria-label="Workspace" className="flex h-full flex-col">
			<div
				className={cn(
					"grid min-h-0 flex-1 content-start gap-[1.1rem] overflow-y-auto pb-3",
					closesDrawer ? "px-3 pt-3" : "px-1.5 pt-1.5",
				)}
			>
				<NavTree closesDrawer={closesDrawer} />
			</div>
			<NavFooter closesDrawer={closesDrawer} />
		</nav>
	);
}

function NavFooter({ closesDrawer }: { closesDrawer: boolean }) {
	// The connection status belongs to the open chat's socket.
	const status = usePiSession((state) => (state.chatId === undefined ? undefined : state.status));
	const isAyoConnected = useLoaderData({ from: "__root__", select: (data) => data.isAyoConnected });
	return (
		<div
			className={cn(
				"flex items-center justify-between gap-2 border-t border-line pt-[0.6rem] pb-3",
				closesDrawer ? "px-3" : "px-[0.6rem]",
			)}
		>
			<Link
				to="/phoebe"
				search={linkSearch(closesDrawer)}
				className="flex min-w-0 items-center gap-[9px] rounded-full py-[3px] pr-3 pl-[3px] text-[15px] font-medium hover:bg-wash data-[status=active]:bg-wash max-wide:min-h-11 touch:min-h-11 max-wide:text-[16px]"
			>
				<Avatar aria-hidden="true">
					<AvatarFallback>O</AvatarFallback>
				</Avatar>
				Phoebe
				{/* The Phoebe page is where a connection is made. */}
				{!isAyoConnected && <NeedsYouDot />}
			</Link>
			<p className="min-w-0 flex-1 truncate text-[13px] text-ink-soft" role="status">
				{status !== undefined && status !== "open" && STATUS_LABELS[status]}
			</p>
			<ThemeToggle />
		</div>
	);
}
