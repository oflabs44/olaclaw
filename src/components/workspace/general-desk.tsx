import { BubbleChatIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

/**
 * The desk of the chats that belong to no desk. It is not stored: it has no brief and no notebook,
 * its chats have no desk id, and `/chats` is its page.
 */
export const GENERAL_DESK_NAME = "General";

/** Its key among the nav's open groups. The key of a stored desk is its id, a row number as text, so it never equals this one. */
export const GENERAL_DESK_FOLDER = "general";

/** Its glyph has no hue: a hue belongs to a desk that Oladayo made. */
export function GeneralDeskIcon({ size = 16 }: { size?: number }) {
	return (
		<span className="inline-flex shrink-0 text-ink-soft" aria-hidden="true">
			<HugeiconsIcon icon={BubbleChatIcon} size={size} strokeWidth={size > 24 ? 1.25 : 1.5} />
		</span>
	);
}
