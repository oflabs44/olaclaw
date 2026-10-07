import { CommandIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { useCurrentPlace } from "./current-place";
import { useOmnibox } from "./panels";

/** Bureau's omni trigger: a quiet pill, at least 280px, that says where you are and is the way in. */
function OmniTrigger() {
	const place = useCurrentPlace();
	const omnibox = useOmnibox();
	const label = place.view ? `${place.section}, ${place.view}` : place.section;

	return (
		<button
			type="button"
			aria-label={`Open the omnibox: ${label}`}
			onClick={() => omnibox.setOpen(true)}
			className="chip-quiet inline-flex h-8 min-w-[280px] cursor-pointer items-center gap-2 justify-self-center rounded-full px-3.5 text-[13px]"
		>
			<HugeiconsIcon icon={Search01Icon} size={15} strokeWidth={1.5} className="text-ink-faint" />
			<span className="font-medium">{place.section}</span>
			{place.view && (
				<>
					<span className="text-ink-faint">/</span>
					<span className="min-w-0 flex-1 truncate text-left text-ink-soft">{place.view}</span>
				</>
			)}
			{!place.view && <span className="flex-1" />}
			<span className="ml-1.5 inline-flex items-center gap-px text-sm text-ink-faint">
				<HugeiconsIcon icon={CommandIcon} size={12} strokeWidth={1.5} />K
			</span>
		</button>
	);
}

/** The dark strip on wide screens: the wordmark, which leads to Today, and the omni trigger. */
export function Chrome() {
	return (
		<header className="on-chrome grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-[0.9rem] py-[0.45rem] max-wide:hidden">
			<Link to="/" search className="justify-self-start rounded pl-[0.2rem] font-bold tracking-[-0.01em]">
				olaclaw
			</Link>
			<OmniTrigger />
		</header>
	);
}
