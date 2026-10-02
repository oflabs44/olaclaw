import handler from "@tanstack/react-start/server-entry";

export { PiAgent } from "./agent";

export default {
	fetch: handler.fetch,
};
