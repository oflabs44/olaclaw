export const TIME_ZONE = "Europe/Berlin";

/** The time for today, the date for a day before, with the year for another year. A fixed locale and zone, so the server render and the hydrating client agree. */
export function formatWhen(epochMilliseconds: number): string {
	const date = new Date(epochMilliseconds);
	const day = (value: Date) => value.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
	if (day(date) === day(new Date())) {
		return date.toLocaleTimeString("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
	}
	// The year only when it is not this one: the places that show it are narrow.
	const year = (value: Date) => value.toLocaleDateString("en-GB", { timeZone: TIME_ZONE, year: "numeric" });
	return date.toLocaleDateString("en-GB", {
		timeZone: TIME_ZONE,
		day: "numeric",
		month: "short",
		year: year(date) === year(new Date()) ? undefined : "numeric",
	});
}
