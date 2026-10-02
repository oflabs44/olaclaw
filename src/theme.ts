import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";

/** The `theme` cookie. Absent means "follow the system". */
export type ThemePreference = "light" | "dark" | "system";

const THEME_COOKIE = "theme";
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export const getThemePreference = createServerFn().handler((): ThemePreference => {
	const theme = getCookie(THEME_COOKIE);
	return theme === "light" || theme === "dark" ? theme : "system";
});

export const setThemePreference = createServerFn({ method: "POST" })
	.validator(z.enum(["light", "dark"]))
	.handler(({ data }) => {
		setCookie(THEME_COOKIE, data, {
			path: "/",
			maxAge: ONE_YEAR_IN_SECONDS,
			sameSite: "lax",
			secure: true,
		});
	});

/** Resolves "system" before first paint, so the page never flashes the wrong theme. */
export const SYSTEM_THEME_SCRIPT = `document.documentElement.dataset.theme ||= matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"`;
