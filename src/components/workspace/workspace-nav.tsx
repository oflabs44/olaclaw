import { ArrowDown01Icon, ArrowRight01Icon, GitBranchIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link, useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import { cn } from "cn";
import { type ReactNode, useLayoutEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

// One row of the tree. The open page's row takes a wash; the others differ only in ink strength.
const navRowClass =
	"flex w-full min-w-0 items-center gap-[9px] rounded-sm px-[0.7rem] py-[0.3rem] text-left text-[15px] text-ink-soft " +
	"transition-colors hover:text-ink data-[status=active]:bg-wash data-[status=active]:text-ink max-wide:min-h-11 touch:min-h-11 max-wide:text-[16px]";

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

// Where the title of a desk's chat starts: under the desk's name, past the glyph and its gap.
const DESK_CHAT_INSET = "calc(0.7rem + 25px)";

// How far one level of branches sits to the right of its parent, in rem.
const BRANCH_INDENT = 0.9;

// A desk's chats already sit one level in, so a branch at a desk may go one level less deep than a
// loose one. The deepest title then has the same room in both.
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
	// The approvals pane of an open chat shows only that chat, so the row says when another chat waits.
	const needsYou = useLoaderData({
		from: "__root__",
		select: (data) =>
			data.approvals.some((approval) => approval.chatId === chat.id && approval.decision === undefined),
	});
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
 * opens and closes the group. The group of the desk you are at stays open.
 */
function DeskGroup({
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
		<div className="grid gap-px">
			<div className="group flex min-w-0 items-center rounded-sm has-[[data-status=active]]:bg-wash">
				<Link
					to="/desks/$deskId"
					params={{ deskId: desk.id }}
					search={linkSearch(closesDrawer)}
					activeOptions={{ exact: true }}
					onClick={() => setDeskFolderOpen(desk.id, true)}
					className="flex min-w-0 flex-1 items-center gap-[9px] rounded-sm px-[0.7rem] py-[0.3rem] text-[15px] font-medium max-wide:min-h-11 touch:min-h-11 max-wide:text-[16px]"
				>
					<DeskIcon icon={desk.icon} hue={desk.hue} />
					<span className="min-w-0 truncate">{desk.name}</span>
					{/* An open group shows the dot on the chat that waits. */}
					{needsYou && !isOpen && <NeedsYouDot />}
				</Link>
				{/* The group of the desk you are at cannot close, so it has no caret. */}
				{!isActive && (
					<button
						type="button"
						aria-label={`${isOpen ? "Collapse" : "Expand"} ${desk.name}`}
						aria-expanded={isOpen}
						onClick={() => setDeskFolderOpen(desk.id, !isOpen)}
						// With a mouse, an open desk shows its caret only under the pointer or the keyboard focus; its name is the way in.
						// A touch screen has no hover, so the caret stays visible there.
						className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-sm text-ink-faint transition-[color,opacity] hover:text-ink aria-expanded:opacity-0 group-hover:aria-expanded:opacity-100 focus-visible:aria-expanded:opacity-100 max-wide:aria-expanded:opacity-100 touch:aria-expanded:opacity-100 max-wide:size-11 touch:size-11"
					>
						<HugeiconsIcon icon={isOpen ? ArrowDown01Icon : ArrowRight01Icon} size={14} strokeWidth={1.75} />
					</button>
				)}
			</div>
			{isOpen && (
				// Indent alone groups the chats under their desk.
				<div className="mb-[0.4rem] grid gap-px empty:hidden">
					{chatTree(
						chats.filter((chat) => chat.deskId === desk.id),
						DESK_BRANCH_DEPTH,
					).map((row) => (
						<ChatLink key={row.chat.id} row={row} inset={DESK_CHAT_INSET} closesDrawer={closesDrawer} />
					))}
				</div>
			)}
		</div>
	);
}

/** The desks, then the way to a new one. A dot on a closed desk says that a chat in it waits for an answer. */
function DeskGroups({ closesDrawer }: { closesDrawer: boolean }) {
	const desks = useLoaderData({ from: "__root__", select: (data) => data.desks });
	const chats = useLoaderData({ from: "__root__", select: (data) => data.chats });
	const approvals = useLoaderData({ from: "__root__", select: (data) => data.approvals });
	const activeDeskId = useActiveDesk()?.id;
	const waitingChatIds = new Set(
		approvals.filter((approval) => approval.decision === undefined).map((approval) => approval.chatId),
	);
	return (
		<div className="grid gap-px">
			{desks.map((desk) => (
				<DeskGroup
					key={desk.id}
					desk={desk}
					isActive={desk.id === activeDeskId}
					needsYou={chats.some((chat) => chat.deskId === desk.id && waitingChatIds.has(chat.id))}
					closesDrawer={closesDrawer}
				/>
			))}
			<Link to="/desks/new" search={linkSearch(closesDrawer)} className={faintRowClass}>
				<HugeiconsIcon icon={PlusSignIcon} size={16} strokeWidth={1.75} className="shrink-0" />
				New desk
			</Link>
		</div>
	);
}

/** The tree: a new chat, the desks with their chats, and the chats that belong to no desk. */
function NavTree({ closesDrawer }: { closesDrawer: boolean }) {
	const chats = useLoaderData({ from: "__root__", select: (data) => data.chats });
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
			<div className="grid gap-px">
				{/* On a wide screen the wordmark leads to Today; the drawer has no wordmark. */}
				{closesDrawer && (
					<Link to="/" search={linkSearch(closesDrawer)} activeOptions={{ exact: true }} className={leadRowClass}>
						Today
					</Link>
				)}
				<button
					type="button"
					disabled={isStartingChat}
					onClick={startChat}
					className={cn(leadRowClass, "cursor-pointer disabled:cursor-default disabled:opacity-35")}
				>
					<HugeiconsIcon icon={PlusSignIcon} size={16} strokeWidth={1.75} className="shrink-0" />
					New chat
				</button>
			</div>
			<DeskGroups closesDrawer={closesDrawer} />
			<div className="grid gap-px">
				<p className="px-[0.7rem] pb-[0.15rem] text-[13px] text-ink-soft">Chats</p>
				{chatTree(chats.filter((chat) => chat.deskId === null)).map((row) => (
					<ChatLink key={row.chat.id} row={row} closesDrawer={closesDrawer} />
				))}
			</div>
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
