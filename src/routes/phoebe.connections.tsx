import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute, Link, useLoaderData, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { connectAyo, getMailboxes, MAIL_TENANT_NAMES } from "@/workspace-data";

export const Route = createFileRoute("/phoebe/connections")({
	loader: () => getMailboxes(),
	component: ConnectionsTab,
});

const mailboxRowClass =
	"flex items-baseline gap-3 border-b border-line py-[0.6rem] text-ink-soft max-wide:min-h-11 max-wide:items-center touch:min-h-11 touch:items-center";

/** The services Phoebe can reach. Each row says what the service gives her and whether she can reach it now. Under them, the mailboxes of mycloud. */
function ConnectionsTab() {
	const isAyoConnected = useLoaderData({ from: "__root__", select: (data) => data.isAyoConnected });
	const { mailboxes, unreadTenants } = Route.useLoaderData();
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
		<div className="grid gap-7 max-wide:gap-6">
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
			<section aria-label="Mailboxes" className="grid border-t border-line">
				{mailboxes.length === 0 && unreadTenants.length === 0 && <p className={mailboxRowClass}>No mailboxes yet.</p>}
				<ul className="grid">
					{mailboxes.map((mailbox) => (
						<li key={`${mailbox.tenant} ${mailbox.address}`} className={mailboxRowClass}>
							<p className="min-w-0 flex-1 [overflow-wrap:anywhere]">
								<span className="mr-2.5 text-ink">{mailbox.address}</span>
								<span className="text-[13px] max-wide:block">
									{[mailbox.label, mailbox.senderName].filter((name) => name !== null).join(" · ")}
								</span>
							</p>
							<span className="shrink-0 text-[13px] text-ink-faint">{MAIL_TENANT_NAMES[mailbox.tenant]}</span>
						</li>
					))}
					{unreadTenants.map((tenant) => (
						<li key={tenant} className={mailboxRowClass} role="status">
							<p className="min-w-0 flex-1">The mailboxes could not be read.</p>
							<span className="shrink-0 text-[13px] text-ink-faint">{MAIL_TENANT_NAMES[tenant]}</span>
						</li>
					))}
				</ul>
				<Link
					to="/phoebe/connections/new-mailbox"
					search
					className="flex items-center gap-[9px] py-[0.6rem] text-ink-faint transition-colors hover:text-ink max-wide:min-h-11 touch:min-h-11"
				>
					<HugeiconsIcon icon={PlusSignIcon} size={16} strokeWidth={1.75} className="shrink-0" />
					Add mailbox
				</Link>
			</section>
		</div>
	);
}
