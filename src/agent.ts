import { DurableObject } from "cloudflare:workers";
import { createModels } from "@earendil-works/pi-ai/models";
import { createRegistry, Harness } from "@earendil-works/pi-durable";
import { PiHarness } from "agents/harness/pi";
import { Lifecycle } from "agents/lifecycle";
import { createAI } from "agents/models/pi-ai";
import { WebSockets } from "agents/websockets";
import { type ChatSummary, Chats } from "./chats";
import { clock, instructions } from "./instructions";
import { Memory, type MemoryEntry } from "./memory";
import { PiSessionSockets } from "./sockets";
import { toolsExtension } from "./tools";
import { memoryExtension } from "./tools/memory";

export class PiAgent extends DurableObject<Env> {
	readonly ai = createAI({ binding: this.env.AI });
	readonly registry = createRegistry();
	readonly memory = new Memory(this.ctx.storage.sql);

	readonly harness = new PiHarness({
		harness: ({ storage, context }) => {
			const models = createModels();
			models.setProvider(this.ai.provider);
			this.registry.install(instructions);
			this.registry.install(memoryExtension(this.memory));
			this.registry.install(toolsExtension(this.chats));
			this.registry.install(clock);
			return Harness.open(storage, { models, registry: this.registry }, context);
		},
		defaults: { model: this.ai("@cf/moonshotai/kimi-k2.7-code") },
	});

	readonly chats = new Chats(this.ctx.storage.sql, this.harness);

	readonly sessionSockets = new PiSessionSockets(
		this.harness,
		() => this.ctx.getWebSockets(),
		(socket) => this.ctx.getTags(socket),
		this.chats,
	);
	readonly webSockets = new WebSockets(this.sessionSockets.options());

	readonly lifecycle = Lifecycle.install(this).use(this.webSockets).use(this.harness);

	// Event watches live in memory; sockets that outlived the last isolate need new ones.
	async onStart(): Promise<void> {
		await this.sessionSockets.reattach();
	}

	listChats(): ChatSummary[] {
		return this.chats.list();
	}

	createChat(): Promise<ChatSummary> {
		return this.chats.create();
	}

	listMemories(): MemoryEntry[] {
		return this.memory.list();
	}
}
