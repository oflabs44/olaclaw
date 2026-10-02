import { createFileRoute } from "@tanstack/react-router";
import { type SubmitEvent, useState } from "react";
import type { ChatMessage } from "../agent";
import { loadMessages, sendPrompt } from "../chat";

export const Route = createFileRoute("/")({
	loader: () => loadMessages(),
	component: ChatPage,
});

function ChatPage() {
	const [messages, setMessages] = useState<ChatMessage[]>(Route.useLoaderData());
	const [prompt, setPrompt] = useState("");
	const [isWaiting, setIsWaiting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		if (prompt.trim() === "" || isWaiting) return;
		setIsWaiting(true);
		setError(null);
		try {
			setMessages(await sendPrompt({ data: prompt }));
			setPrompt("");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setIsWaiting(false);
		}
	}

	return (
		<main style={{ maxWidth: "40rem", margin: "2rem auto", fontFamily: "system-ui, sans-serif" }}>
			<h1>olaclaw</h1>
			<ol style={{ listStyle: "none", padding: 0 }}>
				{messages.map((message) => (
					<li key={message.id} style={{ margin: "0.75rem 0", whiteSpace: "pre-wrap" }}>
						<strong>{message.role === "user" ? "You" : "Agent"}:</strong> {message.text}
					</li>
				))}
			</ol>
			{error && <p role="alert">{error}</p>}
			<form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem" }}>
				<label htmlFor="prompt" style={{ position: "absolute", left: "-9999px" }}>
					Message
				</label>
				<input
					id="prompt"
					value={prompt}
					onChange={(event) => setPrompt(event.target.value)}
					placeholder="Message the agent"
					autoComplete="off"
					style={{ flex: 1, padding: "0.5rem" }}
				/>
				<button type="submit" disabled={isWaiting}>
					{isWaiting ? "Waiting…" : "Send"}
				</button>
			</form>
		</main>
	);
}
