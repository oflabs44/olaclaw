import { Delete02Icon, Notebook01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { toast } from "@/components/ui/toast";
import { PageHeader } from "@/components/workspace/page-header";
import { removeDeskNote } from "@/workspace-data";

export const Route = createFileRoute("/desks/$deskId/notebook")({
	staticData: { section: "Notebook" },
	component: DeskNotebookPage,
});

const deskRoute = getRouteApi("/desks/$deskId");

// A fixed locale and zone, so the server render and the hydrating client agree.
function formatTime(epochMilliseconds: number): string {
	return new Date(epochMilliseconds).toLocaleString("en-GB", {
		timeZone: "Europe/Berlin",
		day: "numeric",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

/** What Phoebe carries from one chat at the desk to the next, newest first. Oladayo can remove a note; she writes them. */
function DeskNotebookPage() {
	const desk = deskRoute.useLoaderData({ select: (data) => data.desk });
	const notes = deskRoute.useLoaderData({ select: (data) => data.notes });
	const router = useRouter();

	async function remove(noteId: number) {
		try {
			await removeDeskNote({ data: { deskId: desk.id, noteId } });
		} catch (error) {
			console.error(`Cannot remove note ${noteId}`, error);
			toast.add({ title: "Could not remove the note", description: "Try again in a moment." });
		}
		await router.invalidate();
	}

	return (
		<>
			<PageHeader title="Notebook" subtitle={desk.name} />
			{notes.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia>
							<HugeiconsIcon icon={Notebook01Icon} strokeWidth={1.5} />
						</EmptyMedia>
						<EmptyTitle>No notes yet</EmptyTitle>
						<EmptyDescription>
							Phoebe writes here where the job stands, and reads it in every chat at this desk.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<ul className="mx-auto grid w-full max-w-[44rem] gap-1 overflow-y-auto p-6 max-wide:p-4">
					{notes.toReversed().map((note) => (
						<li key={note.id} className="flex items-start gap-2 rounded py-2 pr-1 pl-3 hover:bg-wash">
							<div className="min-w-0 flex-1">
								<p className="[overflow-wrap:anywhere]">{note.text}</p>
								<p className="text-sm text-ink-faint">{formatTime(note.createdAt)}</p>
							</div>
							<Button icon aria-label="Remove this note" onClick={() => remove(note.id)}>
								<HugeiconsIcon icon={Delete02Icon} size={17} strokeWidth={1.5} />
							</Button>
						</li>
					))}
				</ul>
			)}
		</>
	);
}
