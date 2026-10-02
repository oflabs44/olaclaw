import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute } from "@tanstack/react-router";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/workspace/page-header";
import { getRoutines } from "@/workspace-data";

export const Route = createFileRoute("/routines")({
	staticData: { section: "Routines" },
	loader: () => getRoutines(),
	component: RoutinesPage,
});

function RoutinesPage() {
	const routines = Route.useLoaderData();
	return (
		<>
			<PageHeader title="Routines" />
			{routines.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia>
							<HugeiconsIcon icon={Calendar03Icon} strokeWidth={1.5} />
						</EmptyMedia>
						<EmptyTitle>No routines yet</EmptyTitle>
						<EmptyDescription>Routines run on a schedule, for example a morning brief.</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<ul className="mx-auto grid w-full max-w-[44rem] gap-1 overflow-y-auto p-6">
					{routines.map((routine) => (
						<li key={routine.id} className="grid rounded px-3 py-2 hover:bg-wash">
							{routine.title}
							<small className="text-ink-soft">{routine.schedule}</small>
						</li>
					))}
				</ul>
			)}
		</>
	);
}
