import {
	Book02Icon,
	Briefcase01Icon,
	Calendar03Icon,
	CodeIcon,
	Home01Icon,
	Mail01Icon,
	UserGroupIcon,
	Wallet01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { cn } from "cn";
import type { DeskHue, DeskIconName } from "@/desk-look";

const ICONS: Record<DeskIconName, IconSvgElement> = {
	mail: Mail01Icon,
	calendar: Calendar03Icon,
	wallet: Wallet01Icon,
	people: UserGroupIcon,
	briefcase: Briefcase01Icon,
	book: Book02Icon,
	code: CodeIcon,
	home: Home01Icon,
};

/** A desk's icon in the desk's own colour, also outside the desk. */
export function DeskIcon({ icon, hue, size = 18 }: { icon: DeskIconName; hue: DeskHue; size?: number }) {
	return (
		<span data-desk={hue} className="inline-flex shrink-0 text-primary">
			<HugeiconsIcon icon={ICONS[icon]} size={size} strokeWidth={1.5} />
		</span>
	);
}

/** The desk's emblem: its icon on a tile of its colour. `className` sets the tile's size and radius. */
export function DeskTile({
	icon,
	hue,
	size,
	className,
}: {
	icon: DeskIconName;
	hue: DeskHue;
	size: number;
	className?: string;
}) {
	return (
		<span
			data-desk={hue}
			className={cn("grid shrink-0 place-items-center bg-primary text-on-primary shadow-(--inset-shadow-chip)", className)}
			aria-hidden="true"
		>
			<HugeiconsIcon icon={ICONS[icon]} size={size} strokeWidth={1.5} />
		</span>
	);
}
