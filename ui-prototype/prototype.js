// Shared fake behaviour for the UI prototypes. No server: replies are canned.
// Each page supplies its own markup through <template id="t-user"> and <template id="t-agent">.

const transcript = document.querySelector("[data-transcript]");
const composer = document.querySelector("[data-composer]");
const input = document.querySelector("[data-input]");
const stopButton = document.querySelector("[data-stop]");
const queueNote = document.querySelector("[data-queue]");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const REPLIES = [
	{
		thinking: "The calendar and the notes folder cover this. Check both, then order by deadline.",
		tool: "Reading your calendar",
		text: "Three things need you this week.\n\nThe board minutes are due on Thursday. The tax office wants the 2025 receipts by Friday. The backup on the NAS failed twice, on Monday and on Tuesday night.\n\nI can draft the minutes from your notes now, and look at the backup log after that.",
	},
	{
		thinking: "A short draft is enough. Keep the tone friendly and put the date first.",
		tool: "Searching your notes",
		text: "Here is a draft.\n\n“Hello Mr. Brandt, Saturday at 10:00 works for the meter reading. I will be at home. Best regards, Oladayo”\n\nSay the word and I will change the time or make it more formal.",
	},
	{
		thinking: "Two failures in a row point at the target disk, not at the schedule.",
		tool: "Reading the backup log",
		text: "The backup stopped because the target volume is 97% full. The last good run was on Sunday at 03:00.\n\nThe oldest snapshots from March use 212 GB. If you delete them, the next run has enough space.",
	},
];

let replyIndex = 0;
let activeRun = null;
const queuedPrompts = [];

function fromTemplate(id) {
	return document.getElementById(id).content.firstElementChild.cloneNode(true);
}

function scrollToEnd() {
	transcript.scrollTo({ top: transcript.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
}

function showQueue() {
	const count = queuedPrompts.length;
	queueNote.hidden = count === 0;
	queueNote.textContent = count === 0 ? "" : `${count} queued behind this run`;
}

function setRunning(isRunning) {
	document.body.dataset.state = isRunning ? "running" : "idle";
	stopButton.hidden = !isRunning;
}

function finishRun() {
	activeRun = null;
	setRunning(false);
	const nextPrompt = queuedPrompts.shift();
	showQueue();
	if (nextPrompt !== undefined) startRun(nextPrompt);
}

function startRun(prompt, { showPrompt = true } = {}) {
	if (showPrompt) {
		const userMessage = fromTemplate("t-user");
		// The prompt text sits on the template root in some pages and on a child in others.
		const promptText = userMessage.matches("[data-text]")
			? userMessage
			: userMessage.querySelector("[data-text]");
		promptText.textContent = prompt;
		transcript.append(userMessage);
	}

	const reply = REPLIES[replyIndex++ % REPLIES.length];
	const agentMessage = fromTemplate("t-agent");
	const thinking = agentMessage.querySelector("[data-thinking]");
	const tool = agentMessage.querySelector("[data-tool]");
	const text = agentMessage.querySelector("[data-text]");
	agentMessage.dataset.live = "true";
	thinking.querySelector("[data-thinking-text]").textContent = reply.thinking;
	tool.querySelector("[data-tool-name]").textContent = reply.tool;
	tool.hidden = true;
	transcript.append(agentMessage);
	scrollToEnd();
	setRunning(true);

	const run = { timers: [], message: agentMessage };
	activeRun = run;
	const later = (delay, action) => run.timers.push(setTimeout(action, reduceMotion ? 0 : delay));

	later(1100, () => {
		tool.hidden = false;
		tool.dataset.status = "running";
		scrollToEnd();
	});
	later(2400, () => {
		tool.dataset.status = "done";
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

composer.addEventListener("submit", (event) => {
	event.preventDefault();
	const prompt = input.value.trim();
	if (prompt === "") return;
	input.value = "";
	if (activeRun) {
		queuedPrompts.push(prompt);
		showQueue();
	} else {
		startRun(prompt);
	}
});

// Enter sends, Shift+Enter makes a new line.
input.addEventListener("keydown", (event) => {
	if (event.key === "Enter" && !event.shiftKey) {
		event.preventDefault();
		composer.requestSubmit();
	}
});

stopButton.addEventListener("click", () => {
	if (!activeRun) return;
	for (const timer of activeRun.timers) {
		clearTimeout(timer);
		clearInterval(timer);
	}
	delete activeRun.message.dataset.live;
	activeRun.message.dataset.stopped = "true";
	queuedPrompts.length = 0;
	showQueue();
	activeRun = null;
	setRunning(false);
});

for (const button of document.querySelectorAll("[data-toggle-chats]")) {
	button.addEventListener("click", () => {
		const isOpen = document.body.classList.toggle("chats-open");
		for (const toggle of document.querySelectorAll("[data-toggle-chats]")) {
			toggle.setAttribute("aria-expanded", String(isOpen));
		}
	});
}

setRunning(false);
showQueue();
// The one moment of motion on load: the newest answer streams in.
const openingPrompt = transcript.dataset.autoplay;
if (openingPrompt) startRun(openingPrompt, { showPrompt: false });
