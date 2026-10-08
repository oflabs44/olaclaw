import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { DeskHome } from "@/components/workspace/desk-home";
import { DeskIcon } from "@/components/workspace/desk-icon";

export const Route = createFileRoute("/desks/$deskId/")({
	staticData: { section: "Home" },
	component: DeskHomePage,
});

const deskRoute = getRouteApi("/desks/$deskId");

/** The first sentence of the brief's first line, without the marks of a Markdown heading or list. */
function firstSentence(brief: string): string {
	const firstLine = brief.trim().split("\n", 1)[0].replace(/^[#>*\-\s]+/, "");
	return /^.*?[.!?](?=\s|$)/.exec(firstLine)?.[0] ?? firstLine;
}

/** The desk's page: its name as the way to its settings, and what it is for. */
function DeskHomePage() {
	const desk = deskRoute.useLoaderData({ select: (data) => data.desk });
	return (
		<DeskHome
			deskId={desk.id}
			placeholder={`New chat at the ${desk.name} desk`}
			header={
				<header>
					<h1 className="-mx-[0.7rem] text-[22px] leading-[1.3] font-semibold tracking-[-0.01em]">
						<Link
							to="/desks/$deskId/settings"
							params={{ deskId: desk.id }}
							search
							aria-label={`${desk.name} settings`}
							className="flex min-w-0 items-center gap-3 rounded-sm px-[0.7rem] py-1 transition-colors hover:bg-wash max-wide:min-h-11 touch:min-h-11"
						>
							<DeskIcon icon={desk.icon} hue={desk.hue} size={22} />
							<span className="min-w-0 flex-1 truncate">{desk.name}</span>
							<HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.75} className="shrink-0 text-ink-faint" />
						</Link>
					</h1>
					<p className="mt-1 text-ink-soft [overflow-wrap:anywhere]">
						{desk.brief === "" ? "No brief yet." : firstSentence(desk.brief)}
					</p>
				</header>
			}
		/>
	);
}
