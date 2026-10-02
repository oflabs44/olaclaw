import { createFileRoute } from "@tanstack/react-router";
import { type SubmitEvent, useState } from "react";
import type { PiMessage, PiMessagePart } from "../transcript";
import { usePiSession } from "../use-pi-session";

export const Route = createFileRoute("/")({
	component: ChatPage,
});

const preformattedStyle = { whiteSpace: "pre-wrap", overflowWrap: "anywhere" } as const;

function MessagePart({ part }: { part: PiMessagePart }) {
	switch (part.type) {
		case "text":
			return <span>{part.text}</span>;
		case "thinking":
			return (
				<details>
					<summary>Thinking</summary>
					{part.text}
				</details>
			);
		case "tool-call":
			return (
				<details>
					<summary>Tool call: {part.name}</summary>
					<pre style={preformattedStyle}>{JSON.stringify(part.arguments, null, 2)}</pre>
				</details>
			);
		case "tool-result":
			return (
				<details>
					<summary>
						Tool result: {part.name}
						{part.error ? " (failed)" : ""}
					</summary>
					<pre style={preformattedStyle}>
						{part.content
							.map((content) => (content.type === "text" ? content.text : "[image]"))
							.join("\n")}
					</pre>
				</details>
			);
		case "image":
			return <span>[image]</span>;
	}
}

const SPEAKER_LABELS: Partial<Record<PiMessage["role"], string>> = {
	user: "You",
	assistant: "Agent",
};

function Message({ message }: { message: PiMessage }) {
	if (message.parts.length === 0 && !message.error) return null;
	const speaker = SPEAKER_LABELS[message.role];
	return (
		<li style={{ margin: "0.75rem 0", ...preformattedStyle }}>
			{speaker && <strong>{speaker}: </strong>}
			{message.parts.map((part, index) => (
				<MessagePart key={index} part={part} />
			))}
			{message.error && <span role="alert">Error: {message.error}</span>}
		</li>
	);
}

function ChatPage() {
	const { status, messages, live, running, tools, queued, retry, error, submit, abort } =
		usePiSession();
	const [prompt, setPrompt] = useState("");
	const isConnected = status === "open";

	function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		if (prompt.trim() === "" || !isConnected) return;
		// Keep the text when the socket closed before React saw the status change.
		if (submit(prompt)) setPrompt("");
	}

	return (
		<main style={{ maxWidth: "40rem", margin: "2rem auto", fontFamily: "system-ui, sans-serif" }}>
			<h1>olaclaw</h1>
			<ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
				{messages.map((message) => (
					<Message key={message.id} message={message} />
				))}
			</ol>
			<div aria-live="polite">
				{live && (
					<ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
						<Message message={live} />
					</ol>
				)}
				{tools.map((tool) => (
					<div key={tool.callId}>
						<p>Running tool: {tool.name}</p>
						{tool.output && <pre style={preformattedStyle}>{tool.output}</pre>}
					</div>
				))}
				{running && !live && tools.length === 0 && (
					<p>{retry ? `Retrying: ${retry.error}` : "Waiting for the model…"}</p>
				)}
				{queued > 0 && <p>{queued} queued behind this run</p>}
			</div>
			{error && <p role="alert">{error}</p>}
			{!isConnected && (
				<p role="status">
					{status === "connecting"
						? "Connecting…"
						: "Reconnecting… Reload the page if this does not recover."}
				</p>
			)}
			<form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem" }}>
				<label htmlFor="prompt" style={{ position: "absolute", left: "-9999px" }}>
					Message
				</label>
				<input
					id="prompt"
					value={prompt}
					onChange={(event) => setPrompt(event.target.value)}
					placeholder={running ? "Queue a follow-up" : "Message the agent"}
					autoComplete="off"
					style={{ flex: 1, padding: "0.5rem" }}
				/>
				<button type="submit" disabled={!isConnected || prompt.trim() === ""}>
					{running ? "Queue" : "Send"}
				</button>
				{running && (
					<button type="button" onClick={abort} disabled={!isConnected}>
						Stop
					</button>
				)}
			</form>
		</main>
	);
}
