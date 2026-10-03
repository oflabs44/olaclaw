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

// A fixed locale and zone, so the server render and the hydrating client agree.
function formatDate(epochMilliseconds: number): string {
	return new Date(epochMilliseconds).toLocaleDateString("en-GB", {
		timeZone: "Europe/Berlin",
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

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
						<EmptyDescription>What Phoebe remembers shows here.</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<ul className="mx-auto grid w-full max-w-[44rem] gap-1 overflow-y-auto p-6">
					{memories.map((memory) => (
						<li key={memory.id} className="rounded px-3 py-2 hover:bg-wash">
							<p>{memory.text}</p>
							<p className="text-sm text-ink-faint">
								{memory.kind === "fact" ? "Fact" : "Note"} · {formatDate(memory.createdAt)}
							</p>
						</li>
					))}
				</ul>
			)}
		</>
	);
}
