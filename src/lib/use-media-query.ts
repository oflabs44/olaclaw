import { useSyncExternalStore } from "react";

/** Server renders get `serverValue`; the client swaps in the real match on hydration. */
export function useMediaQuery(query: string, serverValue = false): boolean {
	return useSyncExternalStore(
		(onChange) => {
			const list = matchMedia(query);
			list.addEventListener("change", onChange);
			return () => list.removeEventListener("change", onChange);
		},
		() => matchMedia(query).matches,
		() => serverValue,
	);
}
