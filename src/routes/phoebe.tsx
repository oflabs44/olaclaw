import { createFileRoute, Link, Outlet, useLoaderData } from "@tanstack/react-router";
import { PageHeader } from "@/components/workspace/page-header";

export const Route = createFileRoute("/phoebe")({
	staticData: { section: "Phoebe" },
	component: PhoebePage,
});

const TABS: { to: "/phoebe/memory" | "/phoebe/connections" | "/phoebe/models"; label: string }[] = [
	{ to: "/phoebe/memory", label: "Memory" },
	{ to: "/phoebe/connections", label: "Connections" },
	{ to: "/phoebe/models", label: "Models" },
];

/** What Phoebe knows, reaches, and runs on: one page, a tab each. */
function PhoebePage() {
	const isAyoConnected = useLoaderData({ from: "__root__", select: (data) => data.isAyoConnected });
	return (
		<>
			<PageHeader title="Phoebe" />
			<div className="overflow-y-auto">
				<div className="mx-auto grid w-full max-w-[44rem] gap-7 px-6 pt-6 pb-8 text-[15px] max-wide:gap-6 max-wide:px-4 max-wide:pt-3 max-wide:text-[16px]">
					<nav aria-label="Phoebe" className="flex gap-6 border-b border-line">
						{TABS.map((tab) => (
							<Link
								key={tab.to}
								to={tab.to}
								search
								// The underline of the open tab lies on the line under the tabs.
								className="-mb-px flex items-center gap-2 border-b-2 border-transparent py-[0.4rem] text-ink-soft hover:text-ink data-[status=active]:border-ink data-[status=active]:font-medium data-[status=active]:text-ink max-wide:min-h-11 touch:min-h-11"
							>
								{tab.label}
								{tab.to === "/phoebe/connections" && !isAyoConnected && (
									<>
										<span className="size-1.5 shrink-0 rounded-full bg-star" aria-hidden="true" />
										<span className="sr-only">, needs you</span>
									</>
								)}
							</Link>
						))}
					</nav>
					<Outlet />
				</div>
			</div>
		</>
	);
}
