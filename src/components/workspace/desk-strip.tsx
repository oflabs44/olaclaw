import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import type { Desk } from "@/desks";
import { DeskIcon } from "./desk-icon";

/**
 * The line under the header of a chat at a desk: which desk, and where its job stands. It leads to
 * the desk's page; on a phone it is the way back there, because the left pane is a closed drawer.
 */
export function DeskStrip({ desk, latestNote }: { desk: Desk; latestNote?: string }) {
	return (
		<Link
			to="/desks/$deskId"
			params={{ deskId: desk.id }}
			search
			className="flex items-center gap-[9px] border-y border-line py-[0.4rem] pr-3 pl-4 text-[13px] hover:bg-wash-soft max-wide:min-h-10 max-wide:pl-[0.9rem]"
		>
			<DeskIcon icon={desk.icon} hue={desk.hue} size={14} />
			<span className="shrink-0 font-medium">{desk.name}</span>
			<span className="min-w-0 flex-1 truncate text-ink-soft">{latestNote}</span>
			<HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={1.75} className="shrink-0 text-ink-faint" />
		</Link>
	);
}
