import { createFileRoute } from "@tanstack/react-router";
import { formatWhen } from "@/lib/format-when";
import { getMemories } from "@/workspace-data";

export const Route = createFileRoute("/phoebe/memory")({
	loader: () => getMemories(),
	component: MemoryTab,
});

function MemoryTab() {
	const memories = Route.useLoaderData();
	if (memories.length === 0) {
		return <p className="text-ink-soft">Nothing remembered yet. What Phoebe remembers shows here.</p>;
	}
	return (
		<ul className="grid">
			{memories.map((memory) => (
				<li
					key={memory.id}
					className="flex items-baseline gap-3 border-b border-line py-[0.6rem] first:pt-0 last:border-b-0"
				>
					<p className="min-w-0 flex-1 [overflow-wrap:anywhere]">{memory.text}</p>
					<time dateTime={new Date(memory.createdAt).toISOString()} className="shrink-0 text-[13px] text-ink-faint">
						{formatWhen(memory.createdAt)}
					</time>
				</li>
			))}
		</ul>
	);
}
