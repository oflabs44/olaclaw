import { ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute, getRouteApi, Link, useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import { type KeyboardEvent, type SubmitEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { chatTree } from "@/components/workspace/chat-tree";
import { DeskIcon } from "@/components/workspace/desk-icon";
import { DeskNotes } from "@/components/workspace/desk-notes";
import { PageHeader } from "@/components/workspace/page-header";
import { ChatLink } from "@/components/workspace/workspace-nav";
import type { Desk } from "@/desks";
import { startDeskChat } from "@/workspace-data";

export const Route = createFileRoute("/desks/$deskId/")({
	staticData: { section: "Home" },
	component: DeskHomePage,
});

const deskRoute = getRouteApi("/desks/$deskId");

const sectionLabelClass = "mb-[0.35rem] flex items-baseline justify-between gap-3 text-[13px] font-normal text-ink-soft";

const textLinkClass = "shrink-0 text-[13px] whitespace-nowrap text-ink-soft underline-offset-[3px] hover:text-ink hover:underline";

// How many notes the page shows; the notebook page has all of them.
const SHOWN_NOTES = 3;

/** The first sentence of the brief's first line, without the marks of a Markdown heading or list. */
function firstSentence(brief: string): string {
	const firstLine = brief.trim().split("\n", 1)[0].replace(/^[#>*\-\s]+/, "");
	return /^.*?[.!?](?=\s|$)/.exec(firstLine)?.[0] ?? firstLine;
}

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
			className="flex items-end gap-1 rounded-[14px] border border-line-strong bg-sheet py-1.5 pr-1.5 transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[0_0_0_3px_var(--primary-wash)]"
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

/** The desk's page: its name and what it is for, where the job stands, the field that starts a chat, and the earlier chats. */
function DeskHomePage() {
	const desk = deskRoute.useLoaderData({ select: (data) => data.desk });
	const notes = deskRoute.useLoaderData({ select: (data) => data.notes });
	const chats = useLoaderData({ from: "__root__", select: (data) => data.chats });
	const deskChats = chatTree(chats.filter((chat) => chat.deskId === desk.id));
	return (
		<>
			{/* The name is in the page, so the header holds only the toggles. */}
			<PageHeader />
			<div className="overflow-y-auto">
				<div className="mx-auto grid w-full max-w-[44rem] gap-7 px-6 pt-6 pb-8 text-[15px] max-wide:gap-6 max-wide:px-4 max-wide:pt-3 max-wide:text-[16px]">
					<header className="grid gap-[0.6rem]">
						<h1 className="flex min-w-0 items-center gap-3 text-[22px] leading-[1.3] font-semibold tracking-[-0.01em]">
							<DeskIcon icon={desk.icon} hue={desk.hue} size={32} />
							<span className="min-w-0 truncate">{desk.name}</span>
						</h1>
						<p className="flex items-baseline justify-between gap-8 text-ink-soft max-wide:block">
							<span className="min-w-0 [overflow-wrap:anywhere]">
								{desk.brief === "" ? "No brief yet, so Phoebe does not know the job." : firstSentence(desk.brief)}
							</span>{" "}
							<Link to="/desks/$deskId/brief" params={{ deskId: desk.id }} search className={textLinkClass}>
								{desk.brief === "" ? "Write the brief" : "Edit brief"}
							</Link>
						</p>
					</header>
					<section>
						<h2 className={sectionLabelClass}>
							Where it stands
							{notes.length > SHOWN_NOTES && (
								<Link to="/desks/$deskId/notebook" params={{ deskId: desk.id }} search className={textLinkClass}>
									All {notes.length} notes
								</Link>
							)}
						</h2>
						{notes.length === 0 ? (
							<p className="text-ink-soft">Phoebe keeps here where the job stands, from one chat to the next.</p>
						) : (
							// The newest notes say where the job stands now.
							<DeskNotes deskId={desk.id} notes={notes.slice(-SHOWN_NOTES).reverse()} />
						)}
					</section>
					<StartChat desk={desk} />
					{deskChats.length > 0 && (
						<section>
							<h2 className={sectionLabelClass}>Chats</h2>
							<div className="-mx-[0.7rem] grid gap-px">
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
