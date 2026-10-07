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

/** A desk's only emblem: its icon as a stroke in the desk's colour. */
export function DeskIcon({ icon, hue, size = 16 }: { icon: DeskIconName; hue: DeskHue; size?: number }) {
	return (
		<span data-desk={hue} className="inline-flex shrink-0 text-primary" aria-hidden="true">
			{/* A large glyph takes a thinner stroke, so it weighs the same as a small one. */}
			<HugeiconsIcon icon={ICONS[icon]} size={size} strokeWidth={size > 24 ? 1.25 : 1.5} />
		</span>
	);
}
