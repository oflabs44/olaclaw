import { createFileRoute, useLoaderData, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { connectAyo } from "@/workspace-data";

export const Route = createFileRoute("/phoebe/connections")({
	component: ConnectionsTab,
});

/** The services Phoebe can reach. Each row says what the service gives her and whether she can reach it now. */
function ConnectionsTab() {
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
		<ul className="grid">
			<li className="flex items-center gap-6">
				<div className="min-w-0 flex-1">
					<p>
						<span className="mr-2.5 font-medium">Ayo</span>
						<span className="text-[13px] text-ink-soft" role="status">
							{isAyoConnected ? "Connected" : "Not connected"}
						</span>
					</p>
					<p className="text-[13px] text-ink-soft">
						Your mail, files, calendar, tasks, and notes. Phoebe runs her code there without asking; the chat shows what she ran.
					</p>
				</div>
				{!isAyoConnected && (
					<Button variant="primary" className="shrink-0" onClick={connect}>
						Connect
					</Button>
				)}
			</li>
		</ul>
	);
}
