import { useEffect } from "react";
import { useLeftPanel, useOmnibox } from "./panels";

function isTyping(target: EventTarget | null) {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable || target.matches("input, textarea, select"))
	);
}

/** `[` toggles the left panel; ⌘K or Ctrl+K opens the omnibox. */
export function WorkspaceKeys() {
	const left = useLeftPanel();
	const omnibox = useOmnibox();

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				omnibox.setOpen(!omnibox.isOpen);
				return;
			}
			if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
			if (event.key === "[") left.toggle();
		}
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	});

	return null;
}
