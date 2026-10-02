import { DurableObject } from "cloudflare:workers";
import { createModels } from "@earendil-works/pi-ai/models";
import { createRegistry, Harness } from "@earendil-works/pi-durable";
import { PiHarness } from "agents/harness/pi";
import { Lifecycle } from "agents/lifecycle";
import { createAI } from "agents/models/pi-ai";

export type ChatMessage = {
	id: number;
	role: "user" | "assistant";
	text: string;
};

export class PiAgent extends DurableObject<Env> {
	readonly ai = createAI({ binding: this.env.AI });
	readonly registry = createRegistry();

	readonly harness = new PiHarness({
		harness: ({ storage, context }) => {
			const models = createModels();
			models.setProvider(this.ai.provider);
			return Harness.open(storage, { models, registry: this.registry }, context);
		},
		defaults: { model: this.ai("@cf/moonshotai/kimi-k2.7-code") },
	});

	readonly lifecycle = Lifecycle.install(this).use(this.harness);

	async messages(): Promise<ChatMessage[]> {
		const chatMessages: ChatMessage[] = [];
		for (const entry of await this.harness.messages()) {
			for (const message of entry.model ?? []) {
				if (message.role !== "user" && message.role !== "assistant") continue;
				const text =
					typeof message.content === "string"
						? message.content
						: message.content
								.map((part) => (part.type === "text" ? part.text : ""))
								.join("");
				if (message.role === "assistant" && message.stopReason === "error") {
					chatMessages.push({
						id: entry.id,
						role: "assistant",
						text: `Error: ${message.errorMessage ?? "model error"}`,
					});
				} else if (text) {
					chatMessages.push({ id: entry.id, role: message.role, text });
				}
			}
		}
		return chatMessages;
	}

	async ask(prompt: string): Promise<ChatMessage[]> {
		await this.harness.prompt(prompt);
		return this.messages();
	}
}
