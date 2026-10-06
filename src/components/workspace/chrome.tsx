import { Activity01Icon, BubbleChatIcon, CommandIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "cn";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { usePiSession } from "@/pi-session";
import { useActiveDesk, useCurrentPlace } from "./current-place";
import { DeskTile } from "./desk-icon";
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
			className="chip-quiet inline-flex h-8 min-w-[280px] cursor-pointer items-center gap-2 justify-self-center rounded-full pr-2 pl-3.5"
		>
			<HugeiconsIcon icon={BubbleChatIcon} size={17} strokeWidth={1.5} className="text-[#4c9cf1]" />
			<span className="text-[13px] font-medium">{place.section}</span>
			{place.view && (
				<>
					<span className="text-sm text-ink-faint">/</span>
					<span className="min-w-0 flex-1 truncate text-left text-[13px] text-ink-soft">{place.view}</span>
				</>
			)}
			{!place.view && <span className="flex-1" />}
			<span className="ml-1.5 inline-flex items-center gap-px px-1.5 font-mono text-[10.5px] text-ink-faint">
				<HugeiconsIcon icon={CommandIcon} size={12} strokeWidth={1.5} />K
			</span>
		</button>
	);
}

/** The dark strip on wide screens: wordmark, the omni trigger, the account. */
export function Chrome() {
	const isRunning = usePiSession((state) => state.running);
	const desk = useActiveDesk();

	return (
		<header className="on-chrome grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-[0.9rem] py-[0.45rem] max-wide:hidden">
			{/* Inside a desk the strip carries the desk's name and emblem in place of the wordmark. */}
			{desk ? (
				<p className="flex min-w-0 items-center gap-2 font-bold tracking-[-0.01em]">
					<DeskTile icon={desk.icon} hue={desk.hue} size={14} className="size-[1.3rem] rounded-[6px]" />
					<span className="truncate">{desk.name}</span>
				</p>
			) : (
				<p className="flex items-center gap-2 font-bold tracking-[-0.01em]">
					<span
						className="grid size-[1.3rem] place-items-center rounded-[6px] bg-[#0275de] shadow-(--inset-shadow-chip)"
						aria-hidden="true"
					>
						<HugeiconsIcon
							icon={Activity01Icon}
							size={14}
							strokeWidth={1.5}
							className={cn("text-white", isRunning && "animate-turn")}
						/>
					</span>
					olaclaw
				</p>
			)}
			<OmniTrigger />
			<div className="flex justify-end">
				<Avatar role="img" aria-label="Oladayo">
					<AvatarFallback className="bg-linear-135 from-[#d9a06b] to-[#8d5a3a] text-white">O</AvatarFallback>
				</Avatar>
			</div>
		</header>
	);
}
