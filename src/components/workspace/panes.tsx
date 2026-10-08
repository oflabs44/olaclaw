import { cn } from "cn";
import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useLeftPanel } from "./panels";
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
			<div style={{ width }} className="h-full">
				{children}
			</div>
		</aside>
	);
}

export function LeftPane() {
	const panel = useLeftPanel();
	return (
		<>
			<SidePane isOpen={!panel.isPhone && panel.isOpen} label="Workspace" width="15.5rem">
				<WorkspaceNav />
			</SidePane>
			<Sheet swipeDirection="left" open={panel.isPhone && panel.isOpen} onOpenChange={panel.setOpen}>
				<SheetContent className="pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
					<SheetTitle className="sr-only">Workspace</SheetTitle>
					<WorkspaceNav closesDrawer />
				</SheetContent>
			</Sheet>
		</>
	);
}
