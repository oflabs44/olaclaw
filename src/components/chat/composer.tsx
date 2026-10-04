import { ArrowDown01Icon, ArrowUp01Icon, StopIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { type KeyboardEvent, type SubmitEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsPhone } from "@/components/workspace/panels";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { MODELS, type ModelId } from "@/models";
import { usePiCommands, usePiSession } from "@/pi-session";
import { setChatModel } from "@/workspace-data";

const chatRoute = getRouteApi("/chats/$chatId");

// The trigger shows the label of the chosen item; the list shows the note too.
const MODEL_ITEMS = MODELS.map((model) => ({ value: model.id, label: model.label }));

function ModelPicker() {
	const router = useRouter();
	const chatId = chatRoute.useParams({ select: (params) => params.chatId });
	const model = chatRoute.useLoaderData({ select: (chat) => chat.model });
	const isPhone = useIsPhone();

	async function changeModel(next: ModelId | null) {
		if (next === null || next === model) return;
		try {
			await setChatModel({ data: { chatId, model: next } });
			await router.invalidate();
		} catch (error) {
			console.error("Cannot change the model", error);
			toast.add({ title: "Could not change the model", description: "Try again in a moment." });
		}
	}

	if (isPhone) return <ModelSheet model={model} onChange={changeModel} />;

	return (
		<Select items={MODEL_ITEMS} value={model} onValueChange={changeModel}>
			<SelectTrigger aria-label="Model">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{MODELS.map((candidate) => (
					<SelectItem key={candidate.id} value={candidate.id}>
						{candidate.label}
						<span className="block text-[12px] text-ink-soft">{candidate.note}</span>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

/** The phone picker: a bottom sheet with one row per model, within reach of a thumb. */
function ModelSheet({ model, onChange }: { model: ModelId; onChange: (next: ModelId) => Promise<void> }) {
	const [isOpen, setIsOpen] = useState(false);
	const current = MODELS.find((candidate) => candidate.id === model);

	return (
		<Sheet open={isOpen} onOpenChange={setIsOpen}>
			<SheetTrigger
				render={
					<Button aria-label="Model" className="bg-wash text-ink">
						{current?.label}
						<HugeiconsIcon icon={ArrowDown01Icon} size={14} strokeWidth={1.5} className="opacity-60" />
					</Button>
				}
			/>
			<SheetContent className="px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] data-[swipe-direction=down]:h-auto">
				<span className="mx-auto mt-0.5 mb-1.5 block h-1 w-10 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
				<SheetTitle className="px-3 py-2 text-center">Model</SheetTitle>
				<ul role="listbox" aria-label="Model">
					{MODELS.map((candidate) => {
						const isChosen = candidate.id === model;
						return (
							<li key={candidate.id}>
								<button
									type="button"
									role="option"
									aria-selected={isChosen}
									onClick={() => {
										setIsOpen(false);
										void onChange(candidate.id);
									}}
									className="flex w-full cursor-pointer items-center gap-3 rounded px-3 py-3 text-left active:bg-wash"
								>
									<span className="min-w-0 flex-1">
										<span className="block text-[16px]">{candidate.label}</span>
										<span className="block text-[13px] text-ink-soft">{candidate.note}</span>
									</span>
									{isChosen && <HugeiconsIcon icon={Tick02Icon} size={18} strokeWidth={1.5} className="shrink-0" />}
								</button>
							</li>
						);
					})}
				</ul>
			</SheetContent>
		</Sheet>
	);
}

function QueuedMessages() {
	const queued = usePiSession((state) => state.queued);
	const queuedTexts = usePiSession((state) => state.queuedTexts);
	if (queued === 0) return null;
	// Pi reports only a count, so the texts show only when this tab queued all of them.
	const knowsTexts = queuedTexts.length === queued;

	return (
		<Collapsible defaultOpen className="mb-2 rounded bg-wash-soft px-2 py-0.5">
			<CollapsibleTrigger className="group flex w-fit cursor-pointer items-center gap-2 rounded-full px-[0.6rem] py-[0.3rem] text-[13px] font-semibold hover:bg-wash touch:min-h-11">
				Queued
				<span className="rounded-sm bg-wash px-1.5 text-[11.5px] font-medium text-ink-soft">{queued}</span>
				<HugeiconsIcon
					icon={ArrowDown01Icon}
					size={15}
					strokeWidth={1.5}
					className="opacity-60 transition-transform group-data-panel-open:rotate-180"
				/>
			</CollapsibleTrigger>
			<CollapsibleContent>
				{knowsTexts ? (
					<ul>
						{queuedTexts.map((text, index) => (
							<li
								key={`${index}-${text}`}
								className="flex items-center gap-2.5 border-t border-line py-1.5 pr-1 pl-3 text-[0.92rem]"
							>
								<span className="min-w-0 flex-1 truncate">{text}</span>
							</li>
						))}
					</ul>
				) : (
					<p className="border-t border-line py-1.5 pl-3 text-[0.92rem] text-ink-soft">
						{queued === 1 ? "1 message waits" : `${queued} messages wait`} for this answer to finish.
					</p>
				)}
			</CollapsibleContent>
		</Collapsible>
	);
}

/** The message field with its toolbar, the queue above it, and the state of the connection. */
export function Composer() {
	const { submit, abort } = usePiCommands();
	const status = usePiSession((state) => state.status);
	const isRunning = usePiSession((state) => state.running);
	const error = usePiSession((state) => state.error);
	const [draft, setDraft] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const isConnected = status === "open";
	const canSend = isConnected && draft.trim() !== "";

	function send() {
		if (!canSend) return;
		// Keep the text when the socket closed before React saw the status change.
		if (submit(draft)) setDraft("");
	}

	function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		send();
	}

	function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
		event.preventDefault();
		send();
	}

	return (
		<footer className="px-[clamp(1rem,4vw,2.5rem)] pt-1.5 pb-4 max-wide:px-3 max-wide:pt-1 max-wide:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
			<div className="mx-auto max-w-[44rem]">
				{error && (
					<p role="alert" className="mb-2 rounded bg-wash-soft px-3 py-2 text-md text-danger">
						{error}
					</p>
				)}
				{!isConnected && (
					<p role="status" className="mb-2 px-1 text-md text-ink-soft">
						{status === "connecting" ? "Connecting…" : "Reconnecting… Reload the page if this does not recover."}
					</p>
				)}
				<QueuedMessages />
				<form
					onSubmit={handleSubmit}
					className="grid rounded-[14px] border border-line-strong bg-sheet shadow-float transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[var(--float-shadow),0_0_0_3px_var(--primary-wash)]"
				>
					<label htmlFor="message" className="sr-only">
						Message
					</label>
					<Textarea
						ref={textareaRef}
						id="message"
						rows={1}
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						onKeyDown={handleKeyDown}
						placeholder={isRunning ? "Queue a follow-up" : "Message Phoebe"}
						autoComplete="off"
						className="max-h-44 min-h-[2.3rem] px-4 pt-3 pb-1 text-[0.98rem] max-wide:px-3.5 max-wide:text-[16px]"
					/>
					<div className="flex items-center gap-0.5 px-2 pt-1 pb-2 max-wide:px-1.5 max-wide:pb-1.5">
						<span className="flex-1" />
						<ModelPicker />
						{isRunning ? (
							<Button
								icon
								aria-label="Stop"
								onClick={abort}
								disabled={!isConnected}
								className="ml-1 bg-ink text-paper hover:bg-ink hover:text-paper"
							>
								<HugeiconsIcon icon={StopIcon} size={18} strokeWidth={1.5} />
							</Button>
						) : (
							<Button type="submit" variant="primary" icon aria-label="Send" disabled={!canSend} className="ml-1">
								<HugeiconsIcon icon={ArrowUp01Icon} size={18} strokeWidth={1.5} />
							</Button>
						)}
					</div>
				</form>
				<p className="mt-2 ml-1 text-[0.8rem] text-ink-faint max-wide:hidden">
					{isRunning
						? "Enter queues your message for after this answer. The square stops the run."
						: "Enter sends. Shift+Enter adds a line."}
				</p>
			</div>
		</footer>
	);
}
