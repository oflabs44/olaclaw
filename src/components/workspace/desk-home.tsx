import { ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import { type KeyboardEvent, type ReactNode, type SubmitEvent, useState } from "react";
import type { ChatSummary } from "@/chats";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { formatWhen } from "@/lib/format-when";
import { startChat } from "@/workspace-data";
import { chatTree } from "./chat-tree";
import { PageHeader } from "./page-header";
import { ChatLink } from "./workspace-nav";

/**
 * The first message of a new chat at the desk, in the place and the look of a chat's composer. That
 * composer needs the socket of an open chat, and here the chat starts on the server before the page opens it.
 */
function StartChat({ deskId, placeholder }: { deskId: string | null; placeholder: string }) {
	const router = useRouter();
	const navigate = useNavigate();
	const [draft, setDraft] = useState("");
	const [isStarting, setIsStarting] = useState(false);
	const canSend = !isStarting && draft.trim() !== "";

	async function start() {
		if (!canSend) return;
		setIsStarting(true);
		let chat: ChatSummary;
		try {
			chat = await startChat({ data: { deskId, text: draft } });
		} catch (error) {
			console.error(`Cannot start a chat at desk ${deskId}`, error);
			toast.add({ title: "Could not start the chat", description: "Try again in a moment." });
			setIsStarting(false);
			return;
		}
		// The chat runs now. A failed reload of the lists must not look like a failed start, or he sends the message twice.
		await router.invalidate().catch((error: unknown) => console.error("Cannot reload the workspace", error));
		await navigate({ to: "/chats/$chatId", params: { chatId: chat.id }, search: true });
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
						placeholder={placeholder}
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

/**
 * The page of a desk: `header` says which desk and what it is for, then its chats, and the field that
 * starts a new one. `deskId` is null for the General desk.
 */
export function DeskHome({
	deskId,
	header,
	placeholder,
}: {
	deskId: string | null;
	header: ReactNode;
	/** What the empty field says, for example which desk the chat starts at. */
	placeholder: string;
}) {
	const chats = useLoaderData({ from: "__root__", select: (data) => data.chats });
	const deskChats = chatTree(chats.filter((chat) => chat.deskId === deskId));
	return (
		<>
			{/* The name is in the page, so the header holds only the toggle. */}
			<PageHeader />
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[clamp(1rem,4vw,2.5rem)] pt-6 pb-4 max-wide:pt-3">
				<div className="mx-auto grid max-w-[44rem] gap-5 text-[15px] max-wide:text-[16px]">
					{header}
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
			<StartChat deskId={deskId} placeholder={placeholder} />
		</>
	);
}
