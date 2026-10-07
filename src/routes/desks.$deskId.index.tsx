import { ArrowRight01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute, getRouteApi, Link, useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import { type KeyboardEvent, type SubmitEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { chatTree } from "@/components/workspace/chat-tree";
import { DeskIcon } from "@/components/workspace/desk-icon";
import { PageHeader } from "@/components/workspace/page-header";
import { ChatLink } from "@/components/workspace/workspace-nav";
import type { Desk } from "@/desks";
import { formatWhen } from "@/lib/format-when";
import { startDeskChat } from "@/workspace-data";

export const Route = createFileRoute("/desks/$deskId/")({
	staticData: { section: "Home" },
	component: DeskHomePage,
});

const deskRoute = getRouteApi("/desks/$deskId");

/** The first sentence of the brief's first line, without the marks of a Markdown heading or list. */
function firstSentence(brief: string): string {
	const firstLine = brief.trim().split("\n", 1)[0].replace(/^[#>*\-\s]+/, "");
	return /^.*?[.!?](?=\s|$)/.exec(firstLine)?.[0] ?? firstLine;
}

/**
 * The first message of a new chat at the desk, in the place and the look of a chat's composer. That
 * composer needs the socket of an open chat, and here the chat starts on the server before the page opens it.
 */
function StartChat({ desk }: { desk: Desk }) {
	const router = useRouter();
	const navigate = useNavigate();
	const [draft, setDraft] = useState("");
	const [isStarting, setIsStarting] = useState(false);
	const canSend = !isStarting && draft.trim() !== "";

	async function start() {
		if (!canSend) return;
		setIsStarting(true);
		try {
			const chat = await startDeskChat({ data: { deskId: desk.id, text: draft } });
			await router.invalidate();
			await navigate({ to: "/chats/$chatId", params: { chatId: chat.id }, search: true });
		} catch (error) {
			console.error(`Cannot start a chat at desk ${desk.id}`, error);
			toast.add({ title: "Could not start the chat", description: "Try again in a moment." });
			setIsStarting(false);
		}
	}

	function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		void start();
	}

	function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
		event.preventDefault();
		void start();
	}

	return (
		<footer className="px-[clamp(1rem,4vw,2.5rem)] pt-1.5 pb-4 max-wide:px-3 max-wide:pt-1 max-wide:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
			<div className="mx-auto max-w-[44rem]">
				<form
					onSubmit={handleSubmit}
					className="grid rounded-[14px] border border-line-strong bg-sheet shadow-float transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[var(--float-shadow),0_0_0_3px_var(--primary-wash)]"
				>
					<label htmlFor="desk-message" className="sr-only">
						Message
					</label>
					<Textarea
						id="desk-message"
						rows={1}
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						onKeyDown={handleKeyDown}
						disabled={isStarting}
						placeholder={`New chat at the ${desk.name} desk`}
						autoComplete="off"
						className="max-h-44 min-h-[2.3rem] px-4 pt-3 pb-1 text-[0.98rem] max-wide:px-3.5 max-wide:text-[16px]"
					/>
					<div className="flex justify-end px-2 pt-1 pb-2 max-wide:px-1.5 max-wide:pb-1.5">
						<Button type="submit" variant="primary" icon aria-label="Send" disabled={!canSend}>
							<HugeiconsIcon icon={ArrowUp01Icon} size={18} strokeWidth={1.5} />
						</Button>
					</div>
				</form>
			</div>
		</footer>
	);
}

/** The desk's page: its name as the way to its settings, what it is for, its chats, and the field that starts a new one. */
function DeskHomePage() {
	const desk = deskRoute.useLoaderData({ select: (data) => data.desk });
	const chats = useLoaderData({ from: "__root__", select: (data) => data.chats });
	const deskChats = chatTree(chats.filter((chat) => chat.deskId === desk.id));
	return (
		<>
			{/* The name is in the page, so the header holds only the toggles. */}
			<PageHeader />
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[clamp(1rem,4vw,2.5rem)] pt-6 pb-4 max-wide:pt-3">
				<div className="mx-auto grid max-w-[44rem] gap-5 text-[15px] max-wide:text-[16px]">
					<header>
						<h1 className="-mx-[0.7rem] text-[22px] leading-[1.3] font-semibold tracking-[-0.01em]">
							<Link
								to="/desks/$deskId/settings"
								params={{ deskId: desk.id }}
								search
								aria-label={`${desk.name} settings`}
								className="flex min-w-0 items-center gap-3 rounded-sm px-[0.7rem] py-1 transition-colors hover:bg-wash max-wide:min-h-11 touch:min-h-11"
							>
								<DeskIcon icon={desk.icon} hue={desk.hue} size={22} />
								<span className="min-w-0 flex-1 truncate">{desk.name}</span>
								<HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.75} className="shrink-0 text-ink-faint" />
							</Link>
						</h1>
						<p className="mt-1 text-ink-soft [overflow-wrap:anywhere]">
							{desk.brief === "" ? "No brief yet." : firstSentence(desk.brief)}
						</p>
					</header>
					{deskChats.length === 0 ? (
						<p className="text-ink-soft">No chats here yet.</p>
					) : (
						<div className="-mx-[0.7rem] grid gap-px">
							{deskChats.map((row) => (
								<ChatLink
									key={row.chat.id}
									row={row}
									trailing={
										<time
											dateTime={new Date(row.chat.updatedAt).toISOString()}
											className="shrink-0 text-[13px] text-ink-faint"
										>
											{formatWhen(row.chat.updatedAt)}
										</time>
									}
								/>
							))}
						</div>
					)}
				</div>
			</div>
			<StartChat desk={desk} />
		</>
	);
}
