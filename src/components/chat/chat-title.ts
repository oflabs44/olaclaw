import { usePiSession } from "@/pi-session";
import type { PiMessage } from "@/transcript";

function firstUserLine(messages: readonly PiMessage[]): string | undefined {
	for (const message of messages) {
		if (message.role !== "user") continue;
		for (const part of message.parts) {
			if (part.type === "text" && part.text.trim() !== "") {
				const line = part.text.trim().split("\n")[0];
				return line.length > 60 ? `${line.slice(0, 59).trimEnd()}…` : line;
			}
		}
	}
	return undefined;
}

/** Chat 1 is the root Pi session: the only chat with a live socket. */
export const ROOT_CHAT_ID = "1";

/** The root chat has no stored name, so it takes its first user message. */
export function useRootChatTitle(): string {
	return usePiSession((state) => firstUserLine(state.messages)) ?? "Chat";
}
