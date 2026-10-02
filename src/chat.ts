import { exports } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";

// One agent object for the single user; chats become Pi sessions inside it later.
const AGENT_NAME = "oladayo";

function agent() {
	return exports.PiAgent.getByName(AGENT_NAME);
}

// Array.from drops the Disposable type of the RPC result, which server functions cannot serialize.
export const loadMessages = createServerFn({ method: "GET" }).handler(async () =>
	Array.from(await agent().messages()),
);

export const sendPrompt = createServerFn({ method: "POST" })
	.validator((prompt: unknown) => {
		if (typeof prompt !== "string" || prompt.trim() === "") {
			throw new Error("Prompt must be a non-empty string");
		}
		return prompt.trim();
	})
	.handler(async ({ data: prompt }) => Array.from(await agent().ask(prompt)));
