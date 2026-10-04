import { DurableObject } from "cloudflare:workers";
import type { Api, Model } from "@earendil-works/pi-ai";
import { createModels, createProvider } from "@earendil-works/pi-ai/models";
import { ANTHROPIC_MODELS } from "@earendil-works/pi-ai/providers/anthropic.models";
import { createRegistry, Harness } from "@earendil-works/pi-durable";
import { PiHarness } from "agents/harness/pi";
import { Lifecycle } from "agents/lifecycle";
import { createAI } from "agents/models/pi-ai";
import { WebSockets } from "agents/websockets";
import { type ApprovalRecord, Approvals } from "./approvals";
import { type ChatSummary, Chats } from "./chats";
import { clock, instructions } from "./instructions";
import { Memory, type MemoryEntry } from "./memory";
import { DEFAULT_MODEL, MODELS, type ModelId } from "./models";
import { PiSessionSockets } from "./sockets";
import { toolsExtension } from "./tools";
import { memoryExtension } from "./tools/memory";

const KIMI = "@cf/moonshotai/kimi-k2.7-code";

export class PiAgent extends DurableObject<Env> {
	// The gateway retries a burst-limited vendor call itself; only a request that still fails falls back to Kimi.
	readonly ai = createAI({
		binding: this.env.AI,
		id: "homey",
		retries: { maxAttempts: 3, retryDelayMs: 1_000, backoff: "exponential" },
	});
	// Kimi answers when a Claude request fails before any output, for example when the gateway credits
	// run out. The answer then carries a fallback diagnostic, which the chat shows under the message.
	readonly models: Record<ModelId, Model<Api>> = {
		"claude-sonnet-5-5": this.ai(ANTHROPIC_MODELS["claude-sonnet-5-5"], { fallback: [KIMI] }),
		"claude-opus-5-5": this.ai(ANTHROPIC_MODELS["claude-opus-5-5"], { fallback: [KIMI] }),
		"kimi-k2.7": this.ai(KIMI),
	};
	readonly registry = createRegistry();
	readonly memory = new Memory(this.ctx.storage.sql);
	readonly approvals = new Approvals(this.ctx.storage.sql);

	readonly harness = new PiHarness({
		harness: ({ storage, context }) => {
			const models = createModels();
			models.setProvider(this.ai.provider);
			// Pi resolves a session's model against this list at each request and uses the listed object, so the
			// Claude models go in with their fallback option attached, under pi-ai's own `anthropic` provider id.
			models.setProvider(
				createProvider({
					id: "anthropic",
					auth: this.ai.provider.auth,
					api: this.ai.provider,
					models: [this.models["claude-sonnet-5-5"], this.models["claude-opus-5-5"]],
				}),
			);
			this.registry.install(instructions);
			this.registry.install(memoryExtension(this.memory));
			this.registry.install(toolsExtension(this.env.AI, this.chats, this.approvals));
			this.registry.install(clock);
			return Harness.open(storage, { models, registry: this.registry }, context);
		},
		defaults: { model: this.models[DEFAULT_MODEL] },
	});

	readonly chats = new Chats(this.ctx.storage.sql, this.harness, (firstMessage) => this.nameChat(firstMessage));

	readonly sessionSockets = new PiSessionSockets(
		this.harness,
		() => this.ctx.getWebSockets(),
		(socket) => this.ctx.getTags(socket),
		this.chats,
		this.approvals,
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

	forkChat(chatId: string, entryId: string): Promise<ChatSummary> {
		return this.chats.fork(chatId, entryId, (model) => ({
			provider: this.models[model].provider,
			modelId: this.models[model].id,
		}));
	}

	/** A short title for a chat, from its first message, by the smallest Claude model. */
	async nameChat(firstMessage: string): Promise<string> {
		const answer = await this.ai.completeSimple(
			this.ai(ANTHROPIC_MODELS["claude-haiku-4-5"]),
			{
				systemPrompt:
					"You name chats. Write a title of at most five words for a chat that starts with the user's message, in the message's language. Reply with the title only: no quotes, no period.",
				messages: [{ role: "user", content: firstMessage.slice(0, 2_000), timestamp: Date.now() }],
			},
			{ maxTokens: 30 },
		);
		const title = answer.content
			.map((block) => (block.type === "text" ? block.text : ""))
			.join("")
			.trim()
			.replace(/^["'“„]+|["'”]+$/g, "")
			.replace(/\.$/, "");
		if (title.length === 0 || title.length > 60) throw new Error(`Unusable title ${JSON.stringify(title)}`);
		return title;
	}

	async setChatModel(chatId: string, model: string): Promise<void> {
		const known = MODELS.find((candidate) => candidate.id === model);
		if (!known) throw new Error(`Unknown model ${JSON.stringify(model)}`);
		if (!this.chats.has(chatId)) throw new Error(`Unknown chat ${JSON.stringify(chatId)}`);
		await this.harness.session(chatId).setModel(this.models[known.id]);
		this.chats.setModel(chatId, known.id);
	}

	listMemories(): MemoryEntry[] {
		return this.memory.list();
	}

	listApprovals(): ApprovalRecord[] {
		return this.approvals.pending();
	}

	decideApproval(callId: string, answer: string): void {
		this.approvals.decide(callId, answer);
	}
}
