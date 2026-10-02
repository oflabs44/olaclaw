import { Brain01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute } from "@tanstack/react-router";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/workspace/page-header";
import { getMemories } from "@/workspace-data";

export const Route = createFileRoute("/memory")({
	staticData: { section: "Memory" },
	loader: () => getMemories(),
	component: MemoryPage,
});

function MemoryPage() {
	const memories = Route.useLoaderData();
	return (
		<>
			<PageHeader title="Memory" />
			{memories.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia>
							<HugeiconsIcon icon={Brain01Icon} strokeWidth={1.5} />
						</EmptyMedia>
						<EmptyTitle>Nothing remembered yet</EmptyTitle>
						<EmptyDescription>What you ask olaclaw to keep in mind shows here.</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<ul className="mx-auto grid w-full max-w-[44rem] gap-1 overflow-y-auto p-6">
					{memories.map((memory) => (
						<li key={memory.id} className="rounded px-3 py-2 hover:bg-wash">
							{memory.text}
						</li>
					))}
				</ul>
			)}
		</>
	);
}
