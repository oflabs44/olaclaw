import { createFileRoute, useLoaderData, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { PageHeader } from "@/components/workspace/page-header";
import { connectAyo } from "@/workspace-data";

export const Route = createFileRoute("/connections")({
	staticData: { section: "Connections" },
	component: ConnectionsPage,
});

/** The services Phoebe can reach. Each row says what the service gives her and whether she can reach it now. */
function ConnectionsPage() {
	const isAyoConnected = useLoaderData({ from: "__root__", select: (data) => data.isAyoConnected });
	const router = useRouter();

	async function connect() {
		try {
			const loginUrl = await connectAyo();
			if (loginUrl !== null) {
				// Ayo's login and consent pages; Ayo sends the browser back to the app afterwards.
				window.location.assign(loginUrl);
				return;
			}
		} catch (error) {
			console.error("Cannot connect Ayo", error);
			toast.add({ title: "Could not connect Ayo", description: "Try again in a moment." });
		}
		await router.invalidate();
	}

	return (
		<>
			<PageHeader title="Connections" />
			<ul className="mx-auto grid w-full max-w-[44rem] gap-2 overflow-y-auto p-6">
				<li className="flex items-center justify-between gap-4 rounded-card border border-line bg-sheet px-4 py-3.5">
					<div className="grid min-w-0 gap-0.5">
						<p className="font-medium">Ayo</p>
						<p className="text-[0.9rem] text-ink-soft">
							Your mail, files, calendar, tasks, and notes. Phoebe runs her code there without asking; the chat shows what she ran.
						</p>
					</div>
					{isAyoConnected ? (
						<p className="flex shrink-0 items-center gap-1.5 text-[0.85rem] text-ink-soft" role="status">
							<span className="size-[0.45rem] rounded-full bg-accent" aria-hidden="true" />
							Connected
						</p>
					) : (
						<Button variant="primary" className="shrink-0" onClick={connect}>
							Connect
						</Button>
					)}
				</li>
			</ul>
		</>
	);
}
