import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMediaQuery } from "@/lib/use-media-query";

/** The server renders the wide layout; CSS already hides what a phone does not show. */
export function useIsPhone(): boolean {
	return useMediaQuery("(max-width: 860px)");
}

export type PanelSide = "left" | "right";

/**
 * A side panel's open state, kept in the root route's search params. An absent param means the
 * device default: open on a wide screen, closed (a drawer or sheet) on a phone.
 */
export function usePanel(side: PanelSide) {
	const value = useSearch({ from: "__root__", select: (search) => search[side] });
	const isPhone = useIsPhone();
	const navigate = useNavigate();
	const isOpen = isPhone ? value === "open" : value !== "closed";

	function setOpen(open: boolean) {
		// Leave the param out when the state is the device default.
		let next: "open" | "closed" | undefined;
		if (open && isPhone) next = "open";
		if (!open && !isPhone) next = "closed";
		void navigate({ to: ".", search: (previous) => ({ ...previous, [side]: next }), replace: true });
	}

	return { isOpen, isPhone, setOpen, toggle: () => setOpen(!isOpen) };
}

export function useOmnibox() {
	const isOpen = useSearch({ from: "__root__", select: (search) => search.omni === true });
	const navigate = useNavigate();

	function setOpen(open: boolean) {
		void navigate({
			to: ".",
			search: (previous) => ({ ...previous, omni: open ? true : undefined }),
			replace: true,
		});
	}

	return { isOpen, setOpen };
}
