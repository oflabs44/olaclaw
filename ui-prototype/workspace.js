// Fake behaviour for the workspace prototype: streaming, reasoning that opens while it streams,
// tool cards with input and output, a queue you can edit, an approval, and a jump-to-latest button.

const transcript = document.querySelector("[data-transcript]");
const conversation = document.querySelector("[data-conversation]");
const composer = document.querySelector("[data-composer]");
const input = document.querySelector("[data-input]");
const submitButton = document.querySelector("[data-submit]");
const queueSection = document.querySelector("[data-queue]");
const queueList = document.querySelector("[data-queue-list]");
const queueCount = document.querySelector("[data-queue-count]");
const jumpButton = document.querySelector("[data-jump]");
const suggestions = document.querySelector("[data-suggestions]");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const REPLIES = [
	{
		thinking: "The calendar and the notes folder cover this. Check both, then order by deadline.",
		tool: { name: "Read calendar", input: { from: "2026-10-05", to: "2026-10-11" }, output: "3 events, 2 deadlines" },
		text: "Three things need you this week.\n\nThe board minutes are due on Thursday. The tax office wants the 2025 receipts by Friday. The backup on the NAS failed twice, on Monday and on Tuesday night.\n\nI can draft the minutes from your notes now, and look at the backup log after that.",
	},
	{
		thinking: "A short draft is enough. Keep the tone friendly and put the date first.",
		tool: { name: "Search notes", input: { query: "Brandt meter reading" }, output: "1 note: “Landlord, meter reading, Saturday 10:00”" },
		text: "Here is a draft.\n\n“Hello Mr. Brandt, Saturday at 10:00 works for the meter reading. I will be at home. Best regards, Oladayo”\n\nSay the word and I will change the time or make it more formal.",
	},
	{
		thinking: "Two failures in a row point at the target disk, not at the schedule.",
		tool: { name: "Read backup log", input: { host: "oflabs-nas", lines: 40 }, output: "03:02 target volume full (97%)" },
		text: "The backup stopped because the target volume is 97% full. The last good run was on Sunday at 03:00.\n\nThe oldest snapshots from March use 212 GB. If you delete them, the next run has enough space.",
	},
];

let replyIndex = 0;
let activeRun = null;
const queuedPrompts = [];

function fromTemplate(id) {
	return document.getElementById(id).content.firstElementChild.cloneNode(true);
}

function isNearBottom() {
	return conversation.scrollHeight - conversation.scrollTop - conversation.clientHeight < 80;
}

function scrollToEnd(force = false) {
	if (!force && !isNearBottom()) return;
	jumpButton.hidden = true;
	conversation.scrollTo({ top: conversation.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
}

conversation.addEventListener("scroll", () => {
	jumpButton.hidden = isNearBottom();
});
jumpButton.addEventListener("click", () => scrollToEnd(true));

function renderQueue() {
	queueList.replaceChildren();
	queuedPrompts.forEach((text, index) => {
		const item = fromTemplate("t-queued");
		item.querySelector("[data-text]").textContent = text;
		item.querySelector("[data-remove]").addEventListener("click", () => {
			queuedPrompts.splice(index, 1);
			renderQueue();
		});
		queueList.append(item);
	});
	queueSection.hidden = queuedPrompts.length === 0;
	queueCount.textContent = String(queuedPrompts.length);
}

function setRunning(isRunning) {
	document.body.dataset.state = isRunning ? "running" : "idle";
	submitButton.setAttribute("aria-label", isRunning ? "Stop" : "Send");
	suggestions.hidden = isRunning;
}

function finishRun() {
	activeRun = null;
	// The suggestions reappear under the transcript, so follow the content once more.
	const wasNearBottom = isNearBottom();
	setRunning(false);
	if (wasNearBottom) requestAnimationFrame(() => scrollToEnd(true));
	const nextPrompt = queuedPrompts.shift();
	renderQueue();
	if (nextPrompt !== undefined) startRun(nextPrompt);
}

function startRun(prompt, { showPrompt = true } = {}) {
	if (showPrompt) {
		const userMessage = fromTemplate("t-user");
		userMessage.querySelector("[data-text]").textContent = prompt;
		transcript.append(userMessage);
	}

	const reply = REPLIES[replyIndex++ % REPLIES.length];
	const agentMessage = fromTemplate("t-agent");
	const reasoning = agentMessage.querySelector("[data-reasoning]");
	const reasoningLabel = agentMessage.querySelector("[data-reasoning-label]");
	const tool = agentMessage.querySelector("[data-tool]");
	const text = agentMessage.querySelector("[data-text]");
	agentMessage.dataset.live = "true";
	reasoning.querySelector("[data-reasoning-text]").textContent = reply.thinking;
	reasoning.open = true;
	reasoning.dataset.streaming = "true";
	reasoningLabel.textContent = "Thinking";
	tool.hidden = true;
	tool.querySelector("[data-tool-name]").textContent = reply.tool.name;
	tool.querySelector("[data-tool-input]").textContent = JSON.stringify(reply.tool.input, null, 2);
	tool.querySelector("[data-tool-output]").textContent = reply.tool.output;
	transcript.append(agentMessage);
	scrollToEnd(true);
	setRunning(true);

	const run = { timers: [], message: agentMessage, startedAt: Date.now() };
	activeRun = run;
	const later = (delay, action) => run.timers.push(setTimeout(action, reduceMotion ? 0 : delay));

	later(1600, () => {
		delete reasoning.dataset.streaming;
		reasoning.open = false;
		reasoningLabel.textContent = `Thought for ${Math.max(1, Math.round((Date.now() - run.startedAt) / 1000))} seconds`;
		tool.hidden = false;
		tool.dataset.status = "running";
		tool.querySelector("[data-tool-badge]").textContent = "Running";
		scrollToEnd();
	});
	later(3000, () => {
		tool.dataset.status = "done";
		tool.querySelector("[data-tool-badge]").textContent = "Done";
		if (reduceMotion) {
			text.textContent = reply.text;
			delete agentMessage.dataset.live;
			finishRun();
			return;
		}
		let position = 0;
		const interval = setInterval(() => {
			position += 3;
			text.textContent = reply.text.slice(0, position);
			scrollToEnd();
			if (position >= reply.text.length) {
				clearInterval(interval);
				delete agentMessage.dataset.live;
				finishRun();
			}
		}, 24);
		run.timers.push(interval);
	});
}

function stopRun() {
	if (!activeRun) return;
	for (const timer of activeRun.timers) {
		clearTimeout(timer);
		clearInterval(timer);
	}
	const { message } = activeRun;
	delete message.dataset.live;
	message.dataset.stopped = "true";
	const reasoning = message.querySelector("[data-reasoning]");
	delete reasoning.dataset.streaming;
	activeRun = null;
	setRunning(false);
	const nextPrompt = queuedPrompts.shift();
	renderQueue();
	if (nextPrompt !== undefined) startRun(nextPrompt);
}

composer.addEventListener("submit", (event) => {
	event.preventDefault();
	const prompt = input.value.trim();
	if (prompt === "") {
		if (activeRun) stopRun();
		return;
	}
	input.value = "";
	if (activeRun) {
		queuedPrompts.push(prompt);
		renderQueue();
	} else {
		startRun(prompt);
	}
});

input.addEventListener("keydown", (event) => {
	if (event.key === "Enter" && !event.shiftKey) {
		event.preventDefault();
		composer.requestSubmit();
	}
});

for (const button of suggestions.querySelectorAll("button")) {
	button.addEventListener("click", () => {
		input.value = button.textContent;
		input.focus();
	});
}

for (const approval of document.querySelectorAll("[data-approval]")) {
	for (const button of approval.querySelectorAll("button")) {
		button.addEventListener("click", () => {
			approval.dataset.state = button.value;
		});
	}
}

for (const [className, attribute] of [["chats-open", "data-toggle-chats"], ["now-open", "data-toggle-now"]]) {
	for (const button of document.querySelectorAll(`[${attribute}]`)) {
		button.addEventListener("click", () => {
			const isOpen = document.body.classList.toggle(className);
			for (const toggle of document.querySelectorAll(`[${attribute}]`)) {
				toggle.setAttribute("aria-expanded", String(isOpen));
			}
		});
	}
}

setRunning(false);
renderQueue();
jumpButton.hidden = true;
const openingPrompt = transcript.dataset.autoplay;
if (openingPrompt) startRun(openingPrompt, { showPrompt: false });
