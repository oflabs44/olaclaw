/**
 * The hues a desk can take. tokens.css turns a hue into the desk's surfaces and its primary, and each
 * hue passes contrast there in both themes.
 */
export const DESK_HUES = ["red", "orange", "amber", "green", "teal", "blue", "violet", "pink"] as const;

export type DeskHue = (typeof DESK_HUES)[number];

/**
 * The hex of `--paper` in tokens.css for each hue, for the browser's theme-color, which does not take
 * a CSS variable. Change both together.
 */
export const DESK_PAPER: Record<DeskHue, { light: string; dark: string }> = {
	red: { light: "#fef3f2", dark: "#190f0e" },
	orange: { light: "#fdf4ee", dark: "#18100a" },
	amber: { light: "#f9f5ed", dark: "#151108" },
	green: { light: "#f0f8f2", dark: "#0c140d" },
	teal: { light: "#edf8f8", dark: "#081414" },
	blue: { light: "#f0f7fe", dark: "#0b1219" },
	violet: { light: "#f6f4fd", dark: "#121019" },
	pink: { light: "#fdf3f7", dark: "#180e13" },
};

export const DESK_ICONS = ["mail", "calendar", "wallet", "people", "briefcase", "book", "code", "home"] as const;

export type DeskIconName = (typeof DESK_ICONS)[number];

export const MAX_DESK_NAME_LENGTH = 40;
export const MAX_DESK_BRIEF_LENGTH = 8_000;
export const MAX_DESK_NOTE_LENGTH = 500;
