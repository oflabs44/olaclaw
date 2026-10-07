/**
 * The hues a desk can take. tokens.css turns a hue into the colour of the desk's glyph, and each hue
 * passes contrast there in both themes.
 */
export const DESK_HUES = ["red", "orange", "amber", "green", "teal", "blue", "violet", "pink"] as const;

export type DeskHue = (typeof DESK_HUES)[number];

export const DESK_ICONS = ["mail", "calendar", "wallet", "people", "briefcase", "book", "code", "home"] as const;

export type DeskIconName = (typeof DESK_ICONS)[number];

export const MAX_DESK_NAME_LENGTH = 40;
export const MAX_DESK_BRIEF_LENGTH = 8_000;
export const MAX_DESK_NOTE_LENGTH = 500;
