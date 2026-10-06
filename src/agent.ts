import { DurableObject } from "cloudflare:workers";
import type { Api, Model } from "@earendil-works/pi-ai";
import { createModels, createProvider } from "@earendil-works/pi-ai/models";
import { ANTHROPIC_MODELS } from "@earendil-works/pi-ai/providers/anthropic.models";
import { createRegistry, Harness, type ModelRef } from "@earendil-works/pi-durable";
import { PiHarness } from "agents/harness/pi";
import { Lifecycle } from "agents/lifecycle";
import { MCPClientManager } from "agents/mcp/client";
import { createAI } from "agents/models/pi-ai";
import { WebSockets } from "agents/websockets";
import { type ApprovalRecord, type ApprovalSummary, Approvals } from "./approvals";
import { type ChatSummary, Chats } from "./chats";
import { type Desk, type DeskInput, type DeskNote, Desks } from "./desks";
import { clock, instructions } from "./instructions";
import { Memory, type MemoryEntry } from "./memory";
import { DEFAULT_MODEL, MODELS, type ModelId } from "./models";
import { AYO_CALLBACK_PATH, ayoCalls, ayoExecuteParts } from "./protocol";
import { PiSessionSockets } from "./sockets";
import { toolsExtension } from "./tools";
import { askExtension } from "./tools/ask";
import { ayoExtension, connectAyo, isAyoConnected, recallFromAyo } from "./tools/ayo";
import { delegateExtension } from "./tools/delegate";
import { deskExtension } from "./tools/desk";
import { memoryExtension } from "./tools/memory";

const KIMI = "@cf/moonshotai/kimi-k2.7-code";

const APPROVAL_LIST_LIMIT = 100;

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
	readonly desks = new Desks(this.ctx.storage.sql);
	readonly deskExtension = deskExtension((session) => this.chats.deskOf(session), this.desks);
	// The MCP client for Ayo. It keeps the OAuth token in this object's storage and restores the connection after a wake.
	readonly mcp = new MCPClientManager("olaclaw", "1.0.0");

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
			const memory = memoryExtension(this.memory, (query, limit, signal) => recallFromAyo(this.mcp, query, limit, signal));
			const ask = askExtension(this.approvals);
			const ayo = ayoExtension(this.mcp);
			const delegate = delegateExtension(this.chats, (model) => this.#modelRef(model), [memory, ask, ayo]);
			// What every chat gets, in prompt order. A chat of a desk adds `deskExtension` after these.
			const everyChat = [instructions, memory, toolsExtension(this.env.AI, this.chats), ask, ayo, delegate, clock];
			for (const extension of everyChat) this.registry.install(extension);
			this.registry.install(this.deskExtension);
			return Harness.open(storage, { models, registry: this.registry, settings: { extensions: everyChat } }, context);
		},
		defaults: { model: this.models[DEFAULT_MODEL] },
	});

	readonly chats = new Chats(
		this.ctx.storage.sql,
		this.harness,
		(firstMessage) => this.nameChat(firstMessage),
		this.deskExtension,
	);

	readonly sessionSockets = new PiSessionSockets(
		this.harness,
		() => this.ctx.getWebSockets(),
		(socket) => this.ctx.getTags(socket),
		this.chats,
		this.approvals,
	);
	readonly webSockets = new WebSockets(this.sessionSockets.options());

	// The MCP client answers Ayo's OAuth callback itself and then redirects to the app's start page.
	readonly lifecycle = Lifecycle.install(this).use(this.mcp).use(this.webSockets).use(this.harness);

	// Event watches live in memory; sockets that outlived the last isolate need new ones.
	async onStart(): Promise<void> {
		await this.sessionSockets.reattach();
	}

	// Only a callback request that the MCP client did not accept gets here.
	onRequest(): Response {
		return new Response("Not found", { status: 404 });
	}

	listChats(): ChatSummary[] {
		return this.chats.list();
	}

	createChat(): Promise<ChatSummary> {
		return this.chats.create();
	}

	forkChat(chatId: string, entryId: string): Promise<ChatSummary> {
		return this.chats.fork(chatId, entryId, (model) => this.#modelRef(model));
	}

	#modelRef(model: ModelId): ModelRef {
		return { provider: this.models[model].provider, modelId: this.models[model].id };
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

	listDesks(): Desk[] {
		return this.desks.list();
	}

	createDesk(input: DeskInput): Desk {
		return this.desks.create(input);
	}

	/** False when no desk has this id. */
	updateDesk(deskId: string, input: DeskInput): boolean {
		return this.desks.update(deskId, input);
	}

	/** A desk with its notebook, oldest note first. Undefined when no desk has this id. */
	getDesk(deskId: string): { desk: Desk; notes: DeskNote[] } | undefined {
		const desk = this.desks.find(deskId);
		return desk && { desk, notes: this.desks.notes(deskId) };
	}

	removeDeskNote(deskId: string, noteId: number): void {
		this.desks.removeNote(deskId, noteId);
	}

	/** A new chat at the desk that starts with `text`. The run goes on without a socket; the chat page then follows it. */
	async startDeskChat(deskId: string, text: string): Promise<ChatSummary> {
		if (!this.desks.find(deskId)) throw new Error(`Unknown desk ${JSON.stringify(deskId)}`);
		// An RPC call does not pass through `fetch`, and the run needs the MCP client for Ayo.
		await this.lifecycle.start();
		const chat = await this.chats.create(deskId);
		this.chats.recordSubmit(chat.id, text);
		await this.harness.session(chat.id).submit(text);
		return chat;
	}

	listMemories(): MemoryEntry[] {
		return this.memory.list();
	}

	listApprovals(): ApprovalSummary[] {
		return this.approvals.list(APPROVAL_LIST_LIMIT).map(({ code, ...approval }) => {
			const source = code === null ? null : ayoExecuteParts(code).code;
			return {
				...approval,
				codeLineCount: source === null ? null : source.split("\n").length,
				codeCalls: source === null ? [] : ayoCalls(source),
			};
		});
	}

	getApproval(callId: string): ApprovalRecord | undefined {
		return this.approvals.find(callId);
	}

	decideApproval(callId: string, answer: string): void {
		this.approvals.decide(callId, answer);
	}

	// An RPC call does not pass through `fetch`, so nothing has started the MCP client yet on a cold object.
	async isAyoConnected(): Promise<boolean> {
		await this.lifecycle.start();
		return isAyoConnected(this.mcp);
	}

	/** Returns the URL of Ayo's login page when Ayo asks for one; `origin` is the app's own. */
	async connectAyo(origin: string): Promise<string | null> {
		await this.lifecycle.start();
		return connectAyo(this.mcp, `${origin}/${AYO_CALLBACK_PATH}`);
	}
}
