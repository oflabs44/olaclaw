import { ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute, getRouteApi, Link, useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import { type KeyboardEvent, type SubmitEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { chatTree } from "@/components/workspace/chat-tree";
import { DeskTile } from "@/components/workspace/desk-icon";
import { PageHeader } from "@/components/workspace/page-header";
import { ChatLink } from "@/components/workspace/workspace-nav";
import type { Desk } from "@/desks";
import { startDeskChat } from "@/workspace-data";

export const Route = createFileRoute("/desks/$deskId/")({
	staticData: { section: "Home" },
	component: DeskHomePage,
});

const deskRoute = getRouteApi("/desks/$deskId");

const sectionHeadingClass = "mb-1.5 flex items-baseline justify-between gap-3 text-[0.8rem] font-semibold text-ink-faint";

// How many notes the home shows; the notebook page has all of them.
const SHOWN_NOTES = 3;

/** The first message of a new chat at the desk. The chat starts on the server, and the page then opens it. */
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
		<form
			onSubmit={handleSubmit}
			className="flex items-end gap-1 rounded-[14px] border border-line-strong bg-sheet py-1.5 pr-1.5 shadow-float transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[var(--float-shadow),0_0_0_3px_var(--primary-wash)]"
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
				placeholder={`Ask at the ${desk.name} desk`}
				autoComplete="off"
				className="max-h-44 min-h-[2.3rem] px-4 py-1.5 text-[0.98rem] max-wide:px-3.5 max-wide:text-[16px]"
			/>
			<Button type="submit" variant="primary" icon aria-label="Send" disabled={!canSend}>
				<HugeiconsIcon icon={ArrowUp01Icon} size={18} strokeWidth={1.5} />
			</Button>
		</form>
	);
}

/** The desk's home: its emblem, the field that starts a chat, where the job stands, and the earlier chats. */
function DeskHomePage() {
	const desk = deskRoute.useLoaderData({ select: (data) => data.desk });
	const notes = deskRoute.useLoaderData({ select: (data) => data.notes });
	const chats = useLoaderData({ from: "__root__", select: (data) => data.chats });
	const deskChats = chatTree(chats.filter((chat) => chat.deskId === desk.id));
	return (
		<>
			<PageHeader title={desk.name} />
			<div className="overflow-y-auto">
				<div className="mx-auto grid w-full max-w-[44rem] gap-7 px-6 pt-10 pb-8 max-wide:px-4 max-wide:pt-6">
					<header className="flex items-center gap-4">
						<DeskTile icon={desk.icon} hue={desk.hue} size={28} className="size-14 rounded-card" />
						<div className="min-w-0">
							<h2 className="truncate text-2xl leading-tight font-semibold tracking-[-0.02em]">{desk.name}</h2>
							{desk.brief === "" && (
								<p className="text-md text-ink-soft">
									No brief yet.{" "}
									<Link
										to="/desks/$deskId/brief"
										params={{ deskId: desk.id }}
										search
										className="underline decoration-line-strong underline-offset-2 hover:text-ink"
									>
										Write one
									</Link>{" "}
									so Phoebe knows the job.
								</p>
							)}
						</div>
					</header>
					<StartChat desk={desk} />
					<section>
						<h3 className={sectionHeadingClass}>
							Notebook
							{notes.length > SHOWN_NOTES && (
								<Link to="/desks/$deskId/notebook" params={{ deskId: desk.id }} search className="font-medium hover:text-ink-soft">
									All {notes.length} notes
								</Link>
							)}
						</h3>
						{notes.length === 0 ? (
							<p className="text-md text-ink-soft">Phoebe keeps here where the job stands, from one chat to the next.</p>
						) : (
							<ul className="grid gap-1.5 border-l-2 border-primary pl-3.5">
								{/* The newest notes say where the job stands now. */}
								{notes.slice(-SHOWN_NOTES).reverse().map((note) => (
									<li key={note.id} className="[overflow-wrap:anywhere]">
										{note.text}
									</li>
								))}
							</ul>
						)}
					</section>
					{deskChats.length > 0 && (
						<section>
							<h3 className={sectionHeadingClass}>Recent</h3>
							<div className="-mx-[0.7rem] grid gap-0.5">
								{deskChats.map((row) => (
									<ChatLink key={row.chat.id} row={row} />
								))}
							</div>
						</section>
					)}
				</div>
			</div>
		</>
	);
}
