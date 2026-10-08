import { BubbleChatIcon, SidebarLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLeftPanel } from "./panels";

/** A pane on a wide screen, which the button shows and hides; a drawer on a phone, which the button only opens. */
function LeftPanelToggle() {
	const panel = useLeftPanel();
	const label = panel.isPhone ? "Open chats" : `${panel.isOpen ? "Hide" : "Show"} the left panel`;

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						icon
						aria-label={label}
						aria-pressed={panel.isPhone ? undefined : panel.isOpen}
						aria-expanded={panel.isPhone ? panel.isOpen : undefined}
						onClick={panel.toggle}
						className="aria-pressed:text-ink max-wide:text-ink"
					/>
				}
			>
				<HugeiconsIcon icon={SidebarLeft01Icon} size={18} strokeWidth={1.5} className="max-wide:hidden" />
				<HugeiconsIcon icon={BubbleChatIcon} size={20} strokeWidth={1.5} className="wide:hidden" />
			</TooltipTrigger>
			<TooltipContent>
				{label} <Kbd className="bg-paper/20 text-paper">[</Kbd>
			</TooltipContent>
		</Tooltip>
	);
}

/**
 * The card header on wide screens and the app bar on phones: the panel toggle, then the title.
 * A page that shows its own title in its content passes none.
 * `subtitle` is a small line under the title, for example where a branch comes from.
 * `status` sits after the title, for example the chat's "Working" indicator.
 */
export function PageHeader({ title, subtitle, status }: { title?: string; subtitle?: ReactNode; status?: ReactNode }) {
	return (
		<header className="flex items-center gap-2.5 px-3 py-[0.55rem] max-wide:gap-1 max-wide:bg-paper max-wide:px-2 max-wide:py-[0.35rem] max-wide:pt-[max(0.35rem,env(safe-area-inset-top))]">
			<LeftPanelToggle />
			<div className="min-w-0 flex-1 pl-1 max-wide:pl-0">
				{title && <h1 className="truncate text-[18px] font-semibold">{title}</h1>}
				{subtitle && <p className="truncate text-[13px] leading-tight text-ink-soft">{subtitle}</p>}
			</div>
			{status}
		</header>
	);
}
