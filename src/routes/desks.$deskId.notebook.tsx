import { Notebook01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { DeskNotes } from "@/components/workspace/desk-notes";
import { PageHeader } from "@/components/workspace/page-header";

export const Route = createFileRoute("/desks/$deskId/notebook")({
	staticData: { section: "Notebook" },
	component: DeskNotebookPage,
});

const deskRoute = getRouteApi("/desks/$deskId");

/** What Phoebe carries from one chat at the desk to the next, newest first. */
function DeskNotebookPage() {
	const desk = deskRoute.useLoaderData({ select: (data) => data.desk });
	const notes = deskRoute.useLoaderData({ select: (data) => data.notes });

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
				<div className="overflow-y-auto">
					<div className="mx-auto w-full max-w-[44rem] px-6 pt-6 pb-8 text-[15px] max-wide:px-4 max-wide:pt-3 max-wide:text-[16px]">
						<DeskNotes deskId={desk.id} notes={notes.toReversed()} />
					</div>
				</div>
			)}
		</>
	);
}
