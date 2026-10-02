import { Home01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute } from "@tanstack/react-router";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/workspace/page-header";
import { getToday } from "@/workspace-data";

export const Route = createFileRoute("/")({
	staticData: { section: "Today" },
	loader: () => getToday(),
	component: TodayPage,
});

function TodayPage() {
	const items = Route.useLoaderData();
	return (
		<>
			<PageHeader title="Today" />
			{items.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia>
							<HugeiconsIcon icon={Home01Icon} strokeWidth={1.5} />
						</EmptyMedia>
						<EmptyTitle>Nothing planned yet</EmptyTitle>
						<EmptyDescription>Your events, deadlines, and the work olaclaw did for you show here.</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<ul className="mx-auto grid w-full max-w-[44rem] gap-1 overflow-y-auto p-6">
					{items.map((item) => (
						<li key={item.id} className="grid rounded px-3 py-2 hover:bg-wash">
							{item.title}
							<small className="text-ink-soft">{item.when}</small>
						</li>
					))}
				</ul>
			)}
		</>
	);
}
