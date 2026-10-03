import { Type } from "@earendil-works/pi-ai";
import { defineExtension, defineTool, section } from "@earendil-works/pi-durable";
import { TIME_ZONE } from "../instructions";
import type { Memory, MemoryEntry } from "../memory";

const GUIDANCE =
	"What you know about Oladayo and his world. Use `recall` before answering about prior work, people, dates, or decisions. Add to it with `remember`; fix wrong entries with `forget` and `remember`. A fact is one sentence about one durable thing; update a fact instead of adding a near-duplicate. Preferences Oladayo states in chat, such as how long or in which language to answer, are facts too: store them and follow them from the next turn.";

function textContent(value: string) {
	return [{ type: "text" as const, text: value }];
}

/** `YYYY-MM-DD` in Oladayo's time zone. */
function formatDate(epochMilliseconds: number): string {
	return new Date(epochMilliseconds).toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

function formatEntries(entries: readonly MemoryEntry[]): string {
	return entries
		.map((entry, index) => `${index + 1}. [id ${entry.id}, ${entry.kind}, ${formatDate(entry.createdAt)}] ${entry.text}`)
		.join("\n");
}

/** Memory tools and the facts section. Its own extension because it reads the object's storage. */
export function memoryExtension(memory: Memory) {
	const remember = defineTool({
		name: "remember",
		description:
			"Save something to long-term memory. kind 'fact': something durable about Oladayo, his people, his preferences, or a standing decision, written as one short sentence; facts appear in every conversation. kind 'note': working context from this conversation worth keeping, written with enough context to stand alone later. Do not save secrets or passwords. Returns the new id. If a call was interrupted, recall before you save again.",
		parameters: Type.Object({
			kind: Type.Union([Type.Literal("fact"), Type.Literal("note")]),
			text: Type.String({ minLength: 1, description: "The fact or note, in plain words." }),
		}),
		async execute({ kind, text }) {
			const trimmed = text.trim();
			if (trimmed.length === 0) return { content: textContent("Nothing to save: the text is empty."), isError: true };
			const id = memory.remember(kind, trimmed);
			return { content: textContent(`Saved ${kind} with id ${id}.`) };
		},
	});

	const recall = defineTool({
		name: "recall",
		description:
			"Search long-term memory (facts and notes) for entries that contain every word of the query, newest first. Use short keywords, such as a name or a topic, not a sentence.",
		parameters: Type.Object({
			query: Type.String({ minLength: 1, description: "One to three keywords." }),
			limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, description: "Default 10." })),
		}),
		replay: "safe",
		async execute({ query, limit }) {
			if (query.trim().length === 0) return { content: textContent("Give at least one keyword."), isError: true };
			const entries = memory.recall(query, limit);
			if (entries.length === 0) return { content: textContent(`Nothing in memory matches "${query}".`) };
			return { content: textContent(formatEntries(entries)) };
		},
	});

	const forget = defineTool({
		name: "forget",
		description:
			"Remove a wrong or outdated memory entry by its id from `recall` or the memory section. To correct an entry, forget it and then remember the corrected version.",
		parameters: Type.Object({ id: Type.Integer({ minimum: 1 }) }),
		replay: "safe",
		async execute({ id }) {
			if (!memory.forget(id)) return { content: textContent(`No memory entry has id ${id}.`), isError: true };
			return { content: textContent(`Forgot entry ${id}.`) };
		},
	});

	return defineExtension({
		name: "memory",
		tools: [remember, recall, forget],
		sections: [
			section("memory", () => {
				const facts = memory.facts();
				if (facts.length === 0) return GUIDANCE;
				return `${GUIDANCE}\n\n${facts.map((fact) => `- [id ${fact.id}] ${fact.text}`).join("\n")}`;
			}),
		],
	});
}
