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
import { MAX_DESK_BRIEF_LENGTH } from "./desk-look";
import { type Desk, type DeskInput, type DeskNote, Desks } from "./desks";
import { type EventRecord, Events } from "./events";
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
import { workspaceExtension } from "./tools/workspace";

const KIMI = "@cf/moonshotai/kimi-k2.7-code";

const APPROVAL_LIST_LIMIT = 100;

const TODAY_LIMIT = 200;
const TODAY_AGE_LIMIT = 7 * 24 * 60 * 60 * 1_000;

/** An event as the Today page shows it. */
export type TodayEvent = EventRecord & {
	/** The approval of an approval event. */
	readonly approval: {
		readonly question: string;
		readonly options: readonly string[];
		/** True when the question comes with a detail or code, which Oladayo must read before he answers. */
		readonly hasMoreToRead: boolean;
	} | null;
};

const BRIEF_WRITER = `You write the brief of a desk for Phoebe, the personal assistant of Oladayo. A desk is a standing job that Oladayo comes back to across days and weeks. Phoebe reads the brief at the start of every chat at the desk. She can reach his mail, calendar, files, tasks, and notes through a connected service, search the web, and keep a notebook for the desk.
You get the name of the desk and what Oladayo wrote about the job. Write the brief, addressed to Phoebe as "you". Cover these points in this order, each only where his words give a basis: what the job is; what his short requests mean here, such as "anything new?"; what to report and what to leave out; what to record in the notebook after each visit; what needs his confirmation first.
Do not invent names, accounts, addresses, or rules that he did not give. Leave a point out when he said nothing about it.
Use short, plain sentences and at most 200 words. Plain text, no Markdown headings. Write in the language of his words. Reply with the brief only.`;

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
	readonly events = new Events(this.ctx.storage.sql);
	readonly approvals = new Approvals(this.ctx.storage.sql, this.events);
	readonly desks = new Desks(this.ctx.storage.sql, this.events);
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
			const workspace = workspaceExtension(this.chats, this.desks);
			const desk = deskExtension((session) => this.chats.deskOf(session), this.desks, this.approvals);
			const delegate = delegateExtension(this.chats, (model) => this.#modelRef(model), [memory, ask, ayo, workspace, desk]);
			// What every chat gets, in prompt order. The desk section differs from chat to chat, so it comes after
			// the sections all chats share, which keeps the cached prefix.
			const everyChat = [
				instructions,
				memory,
				toolsExtension(this.env.AI, this.chats),
				ask,
				ayo,
				delegate,
				workspace,
				desk,
				clock,
			];
			for (const extension of everyChat) this.registry.install(extension);
			return Harness.open(storage, { models, registry: this.registry, settings: { extensions: everyChat } }, context);
		},
		defaults: { model: this.models[DEFAULT_MODEL] },
	});

	readonly chats = new Chats(this.ctx.storage.sql, this.harness, (firstMessage) => this.nameChat(firstMessage), this.events);

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

	/** A brief for a desk from what Oladayo wrote about the job. Nothing is saved: he reads it in the form and saves it himself. */
	async draftDeskBrief(name: string, description: string): Promise<string> {
		const answer = await this.ai.completeSimple(
			this.models[DEFAULT_MODEL],
			{
				systemPrompt: BRIEF_WRITER,
				messages: [
					{
						role: "user",
						content: `Desk name: ${name}\n\nWhat Oladayo wrote about the job:\n${description}`,
						timestamp: Date.now(),
					},
				],
			},
			{ maxTokens: 1_000 },
		);
		// A failed or cut-off answer resolves too; a brief without its end must not look complete.
		if (answer.stopReason !== "stop") throw new Error(`Cannot draft the brief: ${answer.errorMessage ?? answer.stopReason}`);
		const brief = answer.content
			.map((block) => (block.type === "text" ? block.text : ""))
			.join("")
			.trim();
		if (brief.length === 0) throw new Error("The model wrote no brief");
		return brief.slice(0, MAX_DESK_BRIEF_LENGTH);
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
		return this.chats.start(deskId, text);
	}

	/**
	 * Every question that still waits, newest first, then the events of the last 7 days, newest first.
	 * The waiting questions come from the approval table itself, so the log's cap and this limit cannot
	 * hide one, and a question from before the log shows too. A withdrawn question is gone from that table.
	 */
	listToday(): TodayEvent[] {
		const waiting: TodayEvent[] = this.approvals
			.list(APPROVAL_LIST_LIMIT)
			.filter((approval) => approval.decision === null)
			.map((approval, index) => ({
				// Not a log row: a negative id keeps the keys apart from the events'.
				id: -(index + 1),
				at: approval.createdAt,
				kind: "approval_opened",
				deskId: null,
				sessionId: approval.sessionId,
				text: approval.question,
				callId: approval.callId,
				approval: {
					question: approval.question,
					options: approval.options,
					hasMoreToRead: approval.detail !== null || approval.code !== null,
				},
			}));
		const oldest = Date.now() - TODAY_AGE_LIMIT;
		const recent: TodayEvent[] = [];
		for (const event of this.events.list()) {
			if (event.at < oldest || recent.length === TODAY_LIMIT) break;
			if (event.callId === null) {
				recent.push({ ...event, approval: null });
				continue;
			}
			const approval = this.approvals.find(event.callId);
			if (!approval) continue;
			recent.push({
				...event,
				approval: {
					question: approval.question,
					options: approval.options,
					hasMoreToRead: approval.detail !== null || approval.code !== null,
				},
			});
		}
		return [...waiting, ...recent];
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
