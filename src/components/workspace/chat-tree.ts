import type { ChatSummary } from "@/chats";

export type ChatTreeRow = { readonly chat: ChatSummary; readonly depth: number };

// Deeper branches keep this indent, so a title always has room in the phone drawer.
const MAX_DEPTH = 3;

/**
 * The chats in display order, each branch under its parent. Roots sort by the most recent use
 * anywhere in their tree, so a chat rises with its branches; branches sort newest first.
 */
export function chatTree(chats: readonly ChatSummary[]): ChatTreeRow[] {
	const knownIds = new Set(chats.map((chat) => chat.id));
	const branchesByParent = new Map<string | null, ChatSummary[]>();
	for (const chat of chats) {
		const parentId = chat.parentId !== null && knownIds.has(chat.parentId) ? chat.parentId : null;
		branchesByParent.set(parentId, [...(branchesByParent.get(parentId) ?? []), chat]);
	}

	function lastUse(chat: ChatSummary): number {
		return Math.max(chat.updatedAt, ...(branchesByParent.get(chat.id) ?? []).map(lastUse));
	}

	const rows: ChatTreeRow[] = [];
	function addTree(chat: ChatSummary, depth: number) {
		rows.push({ chat, depth: Math.min(depth, MAX_DEPTH) });
		const branches = branchesByParent.get(chat.id) ?? [];
		for (const branch of branches.toSorted((a, b) => b.updatedAt - a.updatedAt)) addTree(branch, depth + 1);
	}
	const roots = branchesByParent.get(null) ?? [];
	for (const root of roots.toSorted((a, b) => lastUse(b) - lastUse(a))) addTree(root, 0);
	return rows;
}

export function parentTitle(chat: ChatSummary, chats: readonly ChatSummary[]): string | undefined {
	return chats.find((candidate) => candidate.id === chat.parentId)?.title;
}
