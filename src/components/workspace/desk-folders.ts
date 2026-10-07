import { createStore, useSelector } from "@tanstack/react-store";

const STORAGE_KEY = "olaclaw.open-desk-folders";

// The desks whose folders the user left open in the nav. Only the browser writes to it, and only after
// hydration, so the server and the first client render both see no open folder.
const openDeskFoldersStore = createStore<readonly string[]>([]);

let isRestored = false;

/** Reads the open folders the browser stored. Call it in a layout effect: after hydration, before the first paint. */
export function restoreOpenDeskFolders() {
	if (isRestored) return;
	isRestored = true;
	try {
		const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
		if (!Array.isArray(stored)) return;
		const deskIds = stored.filter((deskId) => typeof deskId === "string");
		openDeskFoldersStore.setState(() => deskIds);
	} catch {
		// A blocked or damaged storage means only that the folders start closed.
	}
}

export function useIsDeskFolderOpen(deskId: string): boolean {
	return useSelector(openDeskFoldersStore, (deskIds) => deskIds.includes(deskId));
}

export function setDeskFolderOpen(deskId: string, open: boolean) {
	const others = openDeskFoldersStore.state.filter((id) => id !== deskId);
	const deskIds = open ? [...others, deskId] : others;
	openDeskFoldersStore.setState(() => deskIds);
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(deskIds));
	} catch {
		// The state still holds for this visit.
	}
}
