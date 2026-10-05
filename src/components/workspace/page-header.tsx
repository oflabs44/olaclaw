import {
	BubbleChatIcon,
	CheckmarkCircle02Icon,
	SidebarLeft01Icon,
	SidebarRight01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLoaderData } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type PanelSide, usePanel } from "./panels";

const PANEL_NAMES: Record<PanelSide, string> = { left: "left panel", right: "approvals" };
const PHONE_LABELS: Record<PanelSide, string> = { left: "Open chats", right: "Open approvals" };
const PANEL_KEYS: Record<PanelSide, string> = { left: "[", right: "]" };

function PanelToggle({ side, children }: { side: PanelSide; children: ReactNode }) {
	const panel = usePanel(side);
	// The approvals are a sheet on every screen, so their toggle only opens; the sheet closes itself.
	const opensSheet = panel.isPhone || side === "right";
	const label = opensSheet ? PHONE_LABELS[side] : `${panel.isOpen ? "Hide" : "Show"} the ${PANEL_NAMES[side]}`;

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						icon
						aria-label={label}
						aria-pressed={opensSheet ? undefined : panel.isOpen}
						aria-expanded={opensSheet ? panel.isOpen : undefined}
						onClick={panel.toggle}
						className="relative aria-pressed:text-ink max-wide:text-ink"
					/>
				}
			>
				{children}
			</TooltipTrigger>
			<TooltipContent>
				{label} <Kbd className="bg-paper/20 text-paper">{PANEL_KEYS[side]}</Kbd>
			</TooltipContent>
		</Tooltip>
	);
}

/**
 * The card header on wide screens and the app bar on phones: panel toggles around the title.
 * `subtitle` is a small line under the title, for example where a branch comes from.
 * `status` sits after the title, for example the chat's "Working" indicator.
 */
export function PageHeader({ title, subtitle, status }: { title: string; subtitle?: ReactNode; status?: ReactNode }) {
	const needsYouCount = useLoaderData({
		from: "__root__",
		select: (data) => data.approvals.filter((approval) => approval.decision === undefined).length,
	});

	return (
		<header className="relative flex items-center gap-2.5 border-b border-line px-3 py-[0.55rem] max-wide:bg-paper max-wide:px-2 max-wide:py-[0.35rem] max-wide:pt-[max(0.35rem,env(safe-area-inset-top))]">
			<PanelToggle side="left">
				<HugeiconsIcon icon={SidebarLeft01Icon} size={18} strokeWidth={1.5} className="max-wide:hidden" />
				<HugeiconsIcon icon={BubbleChatIcon} size={20} strokeWidth={1.5} className="wide:hidden" />
			</PanelToggle>
			<div className="min-w-0 flex-1 pl-1 max-wide:pl-0 max-wide:text-center">
				<h1 className="truncate text-lg font-semibold max-wide:text-[16px]">{title}</h1>
				{subtitle && <p className="truncate text-sm leading-tight text-ink-soft">{subtitle}</p>}
			</div>
			{status}
			<PanelToggle side="right">
				<HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} strokeWidth={1.5} className="max-wide:hidden" />
				<HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} strokeWidth={1.5} className="wide:hidden" />
				{needsYouCount > 0 && (
					<span
						className="absolute top-2 right-2 size-[7px] rounded-full bg-star shadow-[0_0_0_2px_var(--paper)] wide:hidden"
						aria-hidden="true"
					/>
				)}
			</PanelToggle>
		</header>
	);
}
