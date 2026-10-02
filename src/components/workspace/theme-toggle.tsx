import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { setThemePreference } from "@/theme";

const LABELS = {
	light: "Switch to dark mode",
	dark: "Switch to light mode",
	system: "Switch theme",
};

export function ThemeToggle() {
	const preference = useLoaderData({ from: "__root__", select: (data) => data.theme });
	const router = useRouter();

	async function toggleTheme() {
		// With no cookie the theme follows the system, so only the page knows which one shows.
		const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
		try {
			await setThemePreference({ data: current === "dark" ? "light" : "dark" });
			await router.invalidate();
		} catch {
			toast.add({ title: "Theme not saved", description: "Try again in a moment." });
		}
	}

	return (
		<Button icon aria-label={LABELS[preference]} onClick={toggleTheme}>
			<HugeiconsIcon icon={Moon02Icon} size={18} strokeWidth={1.5} className="dark:hidden" />
			<HugeiconsIcon icon={Sun03Icon} size={18} strokeWidth={1.5} className="hidden dark:block" />
		</Button>
	);
}
