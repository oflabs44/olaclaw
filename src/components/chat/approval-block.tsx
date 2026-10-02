import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { Approval } from "@/workspace-data";

// Decisions are not sent to the agent yet, so a click only says so.
function notWiredYet() {
	toast.add({ title: "Not wired yet", description: "Approvals reach the agent later." });
}

export function ApprovalBlock({ approval, className }: { approval: Approval; className?: string }) {
	return (
		<div className={cn("grid gap-2 rounded bg-star-wash px-[0.9rem] py-[0.8rem]", className)}>
			<p className="font-semibold">
				{approval.question}
				{approval.detail && <q className="block font-normal text-ink-soft">{approval.detail}</q>}
			</p>
			<div className="flex gap-2">
				<Button variant="respond" onClick={notWiredYet}>
					Allow
				</Button>
				<Button variant="quiet" onClick={notWiredYet}>
					Deny
				</Button>
			</div>
		</div>
	);
}
