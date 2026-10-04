import { Type } from "@earendil-works/pi-ai";
import {
	AssistantEntry,
	configure,
	defineExtension,
	defineTool,
	type Extension,
	LiveDoc,
	type ModelRef,
	section,
	UsageDoc,
} from "@earendil-works/pi-durable";
import type { Chats } from "../chats";
import { MODELS, type ModelId } from "../models";
import { DELEGATE_TOOL, type DelegateDetails } from "../protocol";
import { errorResult } from "./fetch-url";

const SUBAGENT_MODEL: ModelId = "claude-sonnet-5-5";
const MAX_SUBAGENTS_AT_ONCE = 4;

const SUBAGENT_INSTRUCTIONS =
	"You are a subagent of Phoebe working on one task for Oladayo. You do not talk to Oladayo. Do the task completely, then answer with the result only: no preamble, no questions. Quote the URLs you used.";

const USAGE = `Use delegate for self-contained work that needs a long read, many searches, or several independent sub-questions. Do not delegate one search or a short answer; do those yourself.
A subagent sees nothing of this conversation and nothing of your memory. Write a complete brief: the goal, the constraints, and what to return.
Call delegate up to ${MAX_SUBAGENTS_AT_ONCE} times at once to run subagents in parallel.
A subagent's answer is material for you, not the reply. Check it, weigh it, and answer Oladayo yourself; never paste it without judgement.`;

/**
 * The `delegate` tool and its prompt section. Its own extension, so a subagent can lose it and not delegate further.
 * `withheldFromSubagent` are the other extensions a subagent must not get.
 */
export function delegateExtension(
	chats: Pick<Chats, "inheritUrls">,
	modelRef: (model: ModelId) => ModelRef,
	withheldFromSubagent: readonly Extension[],
): Extension {
	const delegate = defineTool({
		name: DELEGATE_TOOL,
		description:
			"Delegate self-contained work that needs many tool calls or a long read, such as research, comparing sources, or summarising pages, to a subagent, and get its answer back as text. Several delegate calls at once run in parallel. The subagent cannot see this conversation or your memory, so the brief must contain everything it needs.",
		parameters: Type.Object({
			title: Type.String({
				minLength: 1,
				maxLength: 40,
				description: "A label Oladayo sees while the subagent works, in the language of the chat.",
			}),
			task: Type.String({
				minLength: 1,
				description: "The complete brief: the goal, the constraints, and what to return.",
			}),
			model: Type.Optional(
				Type.Union(
					MODELS.map((model) => Type.Literal(model.id)),
					{ description: `Default ${SUBAGENT_MODEL}. Pick another only when the task needs it.` },
				),
			),
		}),
		// A rerun finds the subagent and the submission the first run made, so the task runs once.
		replay: "safe",
		async execute({ title, task, model = SUBAGENT_MODEL }, api, context) {
			// The round's slots are in call order, so the same calls are refused on a rerun.
			const round = await api.snapshot(LiveDoc, api.conversationId, context);
			const delegateCalls = (round?.tools ?? []).filter((slot) => slot.name === DELEGATE_TOOL);
			if (delegateCalls.findIndex((slot) => slot.callId === api.callId) >= MAX_SUBAGENTS_AT_ONCE) {
				return errorResult("Too many subagents at once");
			}

			const subagentId = await api.commit(async (tx) => {
				const existing = (await tx.scanConversations({ ownerTaskId: api.taskId }, 1)).items[0];
				if (existing !== undefined) return existing.id;
				const created = await tx.createConversation({ ownership: { kind: "task", taskId: api.taskId } });
				await configure(tx, created.id, {
					model: modelRef(model),
					extensions: { remove: [...withheldFromSubagent, extension] },
					instructions: SUBAGENT_INSTRUCTIONS,
				});
				return created.id;
			}, context);
			chats.inheritUrls(String(api.conversationId), String(subagentId));
			// A rerun after a restart starts the clock again; the card then shows the time since the resume.
			const details: DelegateDetails = { conversationId: String(subagentId), model, startedAt: Date.now() };
			await api.details(details, context);

			const subagent = await api.conversation(subagentId, context);
			if (!subagent) throw new Error(`Subagent conversation ${subagentId} is gone`);
			const submission = await subagent.submit(
				{ type: "input", content: task, requestId: `delegate:${api.taskId}` },
				context,
			);
			const settled = await submission.wait(context);
			// A failed subagent has spent time and money too; the card shows both from the result.
			const usage = await api.snapshot(UsageDoc, subagentId, context);
			const ended: DelegateDetails = { ...details, endedAt: Date.now() };
			if (usage) ended.usage = usage;
			if (settled.status !== "done" || settled.type !== "input") {
				const detail = typeof settled.detail === "string" ? `: ${settled.detail}` : "";
				return { ...errorResult(`The subagent did not answer: ${settled.reason}${detail}`), details: ended };
			}
			const answer = await api.commit((tx) => tx.entry(AssistantEntry, settled.answer), context);
			const message = answer?.model?.[0];
			const text =
				message?.role === "assistant"
					? message.content
							.map((block) => (block.type === "text" ? block.text : ""))
							.join("")
							.trim()
					: "";
			if (text === "") return { ...errorResult("The subagent answered without text"), details: ended };
			return { content: [{ type: "text", text }], details: ended };
		},
	});

	const extension = defineExtension({
		name: "delegate",
		tools: [delegate],
		sections: [section("delegate", () => USAGE)],
	});
	return extension;
}
