import { useEffect } from "react";

/**
 * iOS does not shrink the layout for the software keyboard: it scrolls the whole page up instead,
 * which takes the header off the screen. This puts the visible height in `--viewport-height`, so
 * the shell ends at the keyboard, and undoes that scroll.
 */
export function useKeyboardViewport() {
	useEffect(() => {
		const viewport = window.visualViewport;
		if (!viewport) return;

		function fitToVisibleHeight() {
			if (!viewport) return;
			// A pinch zoom also shrinks the visual viewport; the scale takes that out again.
			const height = Math.round(viewport.height * viewport.scale);
			document.documentElement.style.setProperty("--viewport-height", `${height}px`);
			if (viewport.scale === 1) window.scrollTo(0, 0);
		}

		viewport.addEventListener("resize", fitToVisibleHeight);
		viewport.addEventListener("scroll", fitToVisibleHeight);
		return () => {
			viewport.removeEventListener("resize", fitToVisibleHeight);
			viewport.removeEventListener("scroll", fitToVisibleHeight);
			document.documentElement.style.removeProperty("--viewport-height");
		};
	}, []);
}
