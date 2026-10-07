import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "@/components/ui/toast";
import type { DeskNote } from "@/desks";
import { formatWhen } from "@/lib/format-when";
import { removeDeskNote } from "@/workspace-data";

/** Notes of a desk's notebook as plain rows, in the order given. Oladayo can remove a note; Phoebe writes them. */
export function DeskNotes({ deskId, notes }: { deskId: string; notes: readonly DeskNote[] }) {
	const router = useRouter();

	async function remove(noteId: number) {
		try {
			await removeDeskNote({ data: { deskId, noteId } });
		} catch (error) {
			console.error(`Cannot remove note ${noteId}`, error);
			toast.add({ title: "Could not remove the note", description: "Try again in a moment." });
		}
		await router.invalidate();
	}

	return (
		<ul className="grid">
			{notes.map((note) => (
				<li key={note.id} className="group relative flex items-baseline gap-3 py-[0.2rem]">
					<p className="min-w-0 flex-1 [overflow-wrap:anywhere]">{note.text}</p>
					<time dateTime={new Date(note.createdAt).toISOString()} className="shrink-0 text-[13px] text-ink-faint">
						{formatWhen(note.createdAt)}
					</time>
					{/* With a pointer the cross waits in the margin, so the times stay on the column edge. Without one it is always there, after the time. */}
					<button
						type="button"
						aria-label="Remove this note"
						onClick={() => remove(note.id)}
						className="absolute top-1/2 -right-6 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-ink-faint opacity-0 transition-[color,opacity] group-hover:opacity-100 hover:text-ink focus-visible:opacity-100 max-wide:static max-wide:-my-1 max-wide:-mr-2 max-wide:-ml-1.5 max-wide:size-8 max-wide:translate-y-0 max-wide:self-start max-wide:opacity-100 touch:opacity-100"
					>
						<HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={1.75} />
					</button>
				</li>
			))}
		</ul>
	);
}
