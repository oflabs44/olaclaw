import { cn } from "cn";
import { type SubmitEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { DESK_HUES, DESK_ICONS, type DeskHue, type DeskIconName, MAX_DESK_BRIEF_LENGTH, MAX_DESK_NAME_LENGTH } from "@/desk-look";
import type { DeskInput } from "@/desks";
import { draftDeskBrief } from "@/workspace-data";
import { DeskIcon } from "./desk-icon";

const labelClass = "text-[0.85rem] font-semibold text-ink-soft";

// The radio input is hidden; its mark takes the ring when the input is checked or has the keyboard focus.
const choiceMarkClass =
	"grid size-9 cursor-pointer place-items-center rounded-full outline-offset-2 touch:size-11 " +
	"peer-checked:outline-2 peer-checked:outline-ink peer-focus-visible:outline-2 peer-focus-visible:outline-primary";

/**
 * A desk's name, look, and brief. The fields keep their own state; `save` gets the values on submit
 * and decides where to go next. A failed save keeps what was typed.
 */
export function DeskForm({
	desk,
	submitLabel,
	save,
}: {
	desk: DeskInput;
	submitLabel: string;
	save: (input: DeskInput) => Promise<void>;
}) {
	const [isSaving, setIsSaving] = useState(false);
	const [isDrafting, setIsDrafting] = useState(false);
	// What the field held before Phoebe's draft replaced it, so one tap brings it back.
	const [textBeforeDraft, setTextBeforeDraft] = useState<string>();
	const briefField = useRef<HTMLTextAreaElement>(null);

	/** Phoebe turns what the field holds into a brief. The draft only fills the field; Oladayo saves it. */
	async function draftBrief() {
		const field = briefField.current;
		if (!field?.form || isDrafting) return;
		const name = String(new FormData(field.form).get("name")).trim();
		const description = field.value.trim();
		if (name === "" || description === "") {
			toast.add({ title: "Name the desk and write a line about the job", description: "Phoebe drafts the brief from that." });
			return;
		}
		setIsDrafting(true);
		try {
			const draft = await draftDeskBrief({ data: { name, description } });
			setTextBeforeDraft(field.value);
			field.value = draft;
		} catch (error) {
			console.error("Cannot draft the brief", error);
			toast.add({ title: "Could not draft the brief", description: "Try again in a moment." });
		} finally {
			setIsDrafting(false);
		}
	}

	function undoDraft() {
		if (briefField.current && textBeforeDraft !== undefined) briefField.current.value = textBeforeDraft;
		setTextBeforeDraft(undefined);
	}

	async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		if (isSaving) return;
		const fields = new FormData(event.currentTarget);
		setIsSaving(true);
		try {
			await save({
				name: String(fields.get("name")),
				brief: String(fields.get("brief")),
				// The server checks both against the lists.
				hue: String(fields.get("hue")) as DeskHue,
				icon: String(fields.get("icon")) as DeskIconName,
			});
		} catch (error) {
			console.error("Cannot save the desk", error);
			toast.add({ title: "Could not save the desk", description: "Try again in a moment." });
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="mx-auto grid w-full max-w-[44rem] gap-6 p-6 max-wide:p-4">
			<div className="grid gap-1.5">
				<label htmlFor="desk-name" className={labelClass}>
					Name
				</label>
				<Input
					id="desk-name"
					name="name"
					defaultValue={desk.name}
					required
					// `required` takes a name of spaces only, and the server does not.
					pattern=".*\S.*"
					title="Give the desk a name"
					maxLength={MAX_DESK_NAME_LENGTH}
					placeholder="Mail"
					autoComplete="off"
				/>
			</div>
			<fieldset className="grid gap-1.5">
				<legend className={cn(labelClass, "mb-1.5")}>Colour</legend>
				<div className="flex flex-wrap gap-2">
					{DESK_HUES.map((hue) => (
						<label key={hue} title={hue}>
							<input type="radio" name="hue" value={hue} defaultChecked={hue === desk.hue} className="peer sr-only" />
							<span data-desk={hue} className={cn(choiceMarkClass, "border-[5px] border-sheet bg-primary")}>
								<span className="sr-only">{hue}</span>
							</span>
						</label>
					))}
				</div>
			</fieldset>
			<fieldset className="grid gap-1.5">
				<legend className={cn(labelClass, "mb-1.5")}>Icon</legend>
				<div className="flex flex-wrap gap-2">
					{DESK_ICONS.map((icon) => (
						<label key={icon} title={icon}>
							<input type="radio" name="icon" value={icon} defaultChecked={icon === desk.icon} className="peer sr-only" />
							<span className={cn(choiceMarkClass, "bg-wash")}>
								<DeskIcon icon={icon} hue={desk.hue} />
								<span className="sr-only">{icon}</span>
							</span>
						</label>
					))}
				</div>
			</fieldset>
			<div className="grid gap-1.5">
				<label htmlFor="desk-brief" className={labelClass}>
					Brief
				</label>
				<p className="text-[0.85rem] text-ink-soft">
					What this desk is for, what Phoebe checks, and what your short requests mean here. She reads it in every
					chat at this desk. Write it yourself, or write a line about the job and let her draft it. It changes only
					when you save it or approve her proposal.
				</p>
				<Textarea
					ref={briefField}
					id="desk-brief"
					name="brief"
					defaultValue={desk.brief}
					readOnly={isDrafting}
					maxLength={MAX_DESK_BRIEF_LENGTH}
					rows={8}
					placeholder={'"Anything new?" means: check my inbox for mail since the last check. Tell me only what needs a reply or a decision.'}
					className="min-h-48 rounded border border-line-strong bg-sheet px-3.5 py-2.5 transition-colors focus:border-primary max-wide:text-[16px]"
				/>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Button type="submit" variant="primary" disabled={isSaving || isDrafting}>
					{submitLabel}
				</Button>
				<Button variant="quiet" disabled={isDrafting} onClick={draftBrief}>
					{isDrafting ? "Drafting…" : "Draft with Phoebe"}
				</Button>
				{textBeforeDraft !== undefined && <Button onClick={undoDraft}>Undo the draft</Button>}
			</div>
		</form>
	);
}
