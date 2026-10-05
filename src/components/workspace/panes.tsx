import { cn } from "cn";
import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ApprovalsPanel } from "./approvals-panel";
import { usePanel } from "./panels";
import { WorkspaceNav } from "./workspace-nav";

/** A wide-screen pane beside the card. It collapses to zero width, so its content keeps its own width. */
function SidePane({
	isOpen,
	label,
	width,
	children,
}: {
	isOpen: boolean;
	label: string;
	width: string;
	children: ReactNode;
}) {
	return (
		<aside
			aria-label={label}
			inert={!isOpen}
			style={{ width: isOpen ? width : 0 }}
			className={cn(
				"min-w-0 overflow-hidden transition-[width,opacity] max-wide:hidden",
				!isOpen && "opacity-0",
			)}
		>
			<div style={{ width }} className="h-full overflow-y-auto px-1.5 pt-2.5 pb-3.5">
				{children}
			</div>
		</aside>
	);
}

export function LeftPane() {
	const panel = usePanel("left");
	return (
		<>
			<SidePane isOpen={!panel.isPhone && panel.isOpen} label="Workspace" width="15.5rem">
				<WorkspaceNav />
			</SidePane>
			<Sheet swipeDirection="left" open={panel.isPhone && panel.isOpen} onOpenChange={panel.setOpen}>
				<SheetContent
					className="px-3 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
				>
					<SheetTitle className="sr-only">Workspace</SheetTitle>
					<WorkspaceNav closesDrawer />
				</SheetContent>
			</Sheet>
		</>
	);
}

export function ApprovalsPane() {
	const panel = usePanel("right");
	return (
		<>
			<SidePane isOpen={!panel.isPhone && panel.isOpen} label="Approvals" width="17rem">
				<ApprovalsPanel />
			</SidePane>
			<Sheet open={panel.isPhone && panel.isOpen} onOpenChange={panel.setOpen}>
				<SheetContent className="px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
					<span className="mx-auto mt-0.5 mb-1.5 block h-1 w-10 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
					<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
						<ApprovalsPanel isSheet />
					</div>
				</SheetContent>
			</Sheet>
		</>
	);
}
