import { exports } from "cloudflare:workers";
import handler from "@tanstack/react-start/server-entry";
import { AGENT_NAME, SOCKET_PATH } from "./protocol";

export { PiAgent } from "./agent";

export default {
	fetch(request: Request) {
		const url = new URL(request.url);
		const isSocketUpgrade =
			url.pathname === `/${SOCKET_PATH}` &&
			request.headers.get("Upgrade")?.toLowerCase() === "websocket";
		if (!isSocketUpgrade) return handler.fetch(request);

		// Browsers can send cookies on cross-site WebSocket handshakes (no CORS applies), so
		// another site could otherwise open this socket with the user's Cloudflare Access session.
		const origin = request.headers.get("Origin");
		if (origin !== url.origin) {
			console.warn("Rejected socket upgrade from origin", origin);
			return new Response("Forbidden", { status: 403 });
		}
		// The object name is fixed here, so the URL selects only a Pi session, never another object.
		return exports.PiAgent.getByName(AGENT_NAME).fetch(request);
	},
};
