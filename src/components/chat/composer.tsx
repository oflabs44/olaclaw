import {
	ArrowDown01Icon,
	ArrowUp01Icon,
	Attachment01Icon,
	Mic01Icon,
	StopIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { type KeyboardEvent, type SubmitEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MODELS, type ModelId } from "@/models";
import { usePiCommands, usePiSession } from "@/pi-session";
import { setChatModel } from "@/workspace-data";

const chatRoute = getRouteApi("/chats/$chatId");

// The trigger shows the label of the chosen item; the list shows the note too.
const MODEL_ITEMS = MODELS.map((model) => ({ value: model.id, label: model.label }));

const SUGGESTIONS = ["What can you do?", "Help me plan my week", "Draft a short email"];

function notWiredYet() {
	toast.add({ title: "Not wired yet" });
}

function ToolbarButton({ label, icon }: { label: string; icon: typeof Mic01Icon }) {
	return (
		<Tooltip>
			<TooltipTrigger render={<Button icon aria-label={label} onClick={notWiredYet} />}>
				<HugeiconsIcon icon={icon} size={18} strokeWidth={1.5} />
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

function ModelPicker() {
	const router = useRouter();
	const chatId = chatRoute.useParams({ select: (params) => params.chatId });
	const model = chatRoute.useLoaderData({ select: (chat) => chat.model });

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

function QueuedMessages() {
	const queued = usePiSession((state) => state.queued);
	const queuedTexts = usePiSession((state) => state.queuedTexts);
	if (queued === 0) return null;
	// Pi reports only a count, so the texts show only when this tab queued all of them.
	const knowsTexts = queuedTexts.length === queued;

	return (
		<Collapsible defaultOpen className="mb-2 rounded bg-wash-soft px-2 py-0.5">
			<CollapsibleTrigger className="group flex w-fit cursor-pointer items-center gap-2 rounded-full px-[0.6rem] py-[0.3rem] text-[13px] font-semibold hover:bg-wash touch:min-h-9">
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
								className="group/item flex items-center gap-2.5 border-t border-line py-1.5 pr-1 pl-3 text-[0.92rem]"
							>
								<span className="min-w-0 flex-1 truncate">{text}</span>
								<Button
									className="opacity-0 group-focus-within/item:opacity-100 group-hover/item:opacity-100 touch:opacity-100"
									onClick={notWiredYet}
								>
									Remove
								</Button>
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

	function applySuggestion(text: string) {
		setDraft(text);
		textareaRef.current?.focus();
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
				{!isRunning && (
					<div className="mb-2.5 flex gap-1.5 max-wide:-mx-3 max-wide:overflow-x-auto max-wide:px-3 max-wide:[scrollbar-width:none] wide:flex-wrap">
						{SUGGESTIONS.map((suggestion) => (
							<button
								key={suggestion}
								type="button"
								onClick={() => applySuggestion(suggestion)}
								className="h-7 shrink-0 cursor-pointer rounded-full border border-line-strong bg-sheet px-3 text-[13px] whitespace-nowrap text-ink-soft hover:bg-wash hover:text-ink touch:h-10"
							>
								{suggestion}
							</button>
						))}
					</div>
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
						placeholder={isRunning ? "Queue a follow-up" : "Message olaclaw"}
						autoComplete="off"
						className="max-h-44 min-h-[2.3rem] px-4 pt-3 pb-1 text-[0.98rem] max-wide:px-3.5 max-wide:text-[16px]"
					/>
					<div className="flex items-center gap-0.5 px-2 pt-1 pb-2 max-wide:px-1.5 max-wide:pb-1.5">
						<ToolbarButton label="Add a file" icon={Attachment01Icon} />
						<ToolbarButton label="Speak" icon={Mic01Icon} />
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
