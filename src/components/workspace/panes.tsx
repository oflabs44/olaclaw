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

/**
 * The approvals: a sheet from the right on a wide screen and a bottom sheet on a phone, so the page
 * keeps one sidebar. On a wide screen it opens inside `card`, the page's card, and leaves the chrome
 * and the left pane free and usable.
 */
export function ApprovalsPane({ card }: { card: HTMLElement | null }) {
	const panel = usePanel("right");
	return (
		<Sheet
			swipeDirection={panel.isPhone ? "down" : "right"}
			// Focus stays in the sheet, but a click on the left pane still works; it also closes the sheet.
			modal={panel.isPhone ? true : "trap-focus"}
			open={panel.isOpen}
			onOpenChange={panel.setOpen}
		>
			<SheetContent
				container={panel.isPhone ? undefined : card}
				className={
					panel.isPhone
						? "px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
						: "border-l border-line px-3 pt-3 pb-4 shadow-float"
				}
			>
				{panel.isPhone && (
					<span className="mx-auto mt-0.5 mb-1.5 block h-1 w-10 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
				)}
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
					<ApprovalsPanel />
				</div>
			</SheetContent>
		</Sheet>
	);
}
