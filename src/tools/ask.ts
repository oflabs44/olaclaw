import { Type } from "@earendil-works/pi-ai";
import { defineTool } from "@earendil-works/pi-durable";
import type { Approvals } from "../approvals";
import { ASK_TOOL } from "../protocol";

/** The call stays open until Oladayo picks an option, in the chat or in the Now panel. */
export function askTool(approvals: Pick<Approvals, "open" | "wait">) {
	return defineTool({
		name: ASK_TOOL,
		description:
			"Ask Oladayo a question and wait for his answer, however long it takes. He picks one of your options or writes his own answer. Ask only when the answer changes what you do next. Give concrete options and put the one you recommend first. Never ask what memory or this conversation already answers.",
		parameters: Type.Object({
			question: Type.String({ minLength: 1, description: "One short question." }),
			options: Type.Array(Type.String({ minLength: 1, description: "A few words; shown on a button." }), {
				minItems: 2,
				maxItems: 4,
				uniqueItems: true,
				description: "The choices, recommended one first.",
			}),
			detail: Type.Optional(
				Type.String({ description: "Context shown under the question, for example what each option leads to." }),
			),
		}),
		// A rerun finds the row the first run opened, so the question is asked once.
		replay: "safe",
		async execute({ question, options, detail }, api, context) {
			approvals.open(String(api.conversationId), api.callId, question, options, detail);
			const answer = await approvals.wait(api.callId, context.abortSignal);
			const text = options.includes(answer) ? `Oladayo chose: ${answer}` : `Oladayo answered in his own words: ${answer}`;
			return { content: [{ type: "text", text }] };
		},
	});
}
