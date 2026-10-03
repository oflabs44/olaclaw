import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link, type LinkProps, useLoaderData } from "@tanstack/react-router";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import type { WorkspaceSearch } from "@/routes/__root";
import { useOmnibox } from "./panels";

type Destination = { key: string; label: string; group: string } & Pick<LinkProps, "to" | "params">;

const closeOmnibox = (previous: WorkspaceSearch) => ({ ...previous, omni: undefined });

/** ⌘K: a search field over the places in the workspace. Real search comes later. */
export function Omnibox() {
	const omnibox = useOmnibox();
	const chats = useLoaderData({ from: "__root__", select: (data) => data.chats });
	const [query, setQuery] = useState("");

	const destinations: Destination[] = [
		{ key: "today", label: "Today", group: "Go to", to: "/" },
		{ key: "routines", label: "Routines", group: "Go to", to: "/routines" },
		{ key: "memory", label: "Memory", group: "Go to", to: "/memory" },
		{ key: "chats", label: "All chats", group: "Go to", to: "/chats" },
		...chats.map((chat) => ({
			key: `chat-${chat.id}`,
			label: chat.title,
			group: "Chats",
			to: "/chats/$chatId" as const,
			params: { chatId: chat.id },
		})),
	];
	const matches = destinations.filter((destination) =>
		destination.label.toLowerCase().includes(query.trim().toLowerCase()),
	);

	return (
		<Dialog
			open={omnibox.isOpen}
			onOpenChange={(open) => {
				omnibox.setOpen(open);
				if (!open) setQuery("");
			}}
		>
			<DialogContent className="p-2">
				<DialogTitle className="sr-only">Omnibox</DialogTitle>
				<div className="relative">
					<HugeiconsIcon
						icon={Search01Icon}
						size={17}
						strokeWidth={1.5}
						className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
					/>
					<Input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search or go to…"
						aria-label="Search"
						className="h-10 border-transparent bg-wash pl-9 focus:border-transparent"
					/>
				</div>
				<ul className="grid max-h-[50vh] gap-0.5 overflow-y-auto">
					{matches.map((destination, index) => (
						<li key={destination.key}>
							{(index === 0 || matches[index - 1].group !== destination.group) && (
								<p className="px-3 pt-2 pb-1 text-sm font-semibold text-ink-faint">{destination.group}</p>
							)}
							<Link
								to={destination.to}
								params={destination.params}
								search={closeOmnibox}
								className="flex items-center rounded px-3 py-2 text-md hover:bg-wash focus-visible:bg-wash touch:min-h-11"
							>
								<span className="truncate">{destination.label}</span>
							</Link>
						</li>
					))}
					{matches.length === 0 && <li className="px-3 py-2 text-md text-ink-soft">No matches</li>}
				</ul>
				<p className="flex items-center gap-1.5 px-3 pb-1 text-sm text-ink-faint">
					<Kbd>Esc</Kbd> closes
				</p>
			</DialogContent>
		</Dialog>
	);
}
