import { ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "cn";
import { type CSSProperties, type FormEvent, type ReactNode, Suspense, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ayoExecuteParts } from "@/protocol";
import { type HighlightedToken, highlightLines } from "./code-highlighter";

export type ApprovalQuestion = {
	readonly question: string;
	readonly detail?: string;
	/** Code the answer decides on, as `ayoExecuteCode` prints it. */
	readonly code?: string;
	readonly options: readonly string[];
};

const optionRow =
	"flex min-h-11 w-full cursor-pointer items-center gap-3 rounded px-3 py-2 text-left text-[0.95rem] " +
	"transition-colors touch:min-h-12";

/**
 * Text as numbered lines, never clipped or scrolled inside the block: all that Oladayo approves is on
 * the page, and a long line that wraps still reads as one line. The lines come from the text itself;
 * tokens only add colour.
 */
function NumberedLines({ lines, tokens }: { lines: readonly string[]; tokens?: HighlightedToken[][] | null }) {
	return (
		<div className="px-2.5 py-2 font-mono text-sm">
			{lines.map((line, index) => (
				<div key={index} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2">
					<span className="text-right text-ink-faint select-none">{index + 1}</span>
					<span className="whitespace-pre-wrap [tab-size:2] [overflow-wrap:anywhere]">
						{tokens?.[index]?.map((token, tokenIndex) => (
							<span
								key={tokenIndex}
								// The same switch as Streamdown's code blocks: one variable per theme, ink when there is none.
								className="text-[color:var(--shiki,inherit)] dark:text-[color:var(--shiki-dark,inherit)]"
								style={{ "--shiki": token.color, "--shiki-dark": token.darkColor } as CSSProperties}
							>
								{token.content}
							</span>
						)) ?? line}
					</span>
				</div>
			))}
		</div>
	);
}

function HighlightedLines({ text, lines, language }: { text: string; lines: readonly string[]; language: string }) {
	return <NumberedLines lines={lines} tokens={use(highlightLines(text, language))} />;
}

function CodePanel({ name, text, language }: { name: string; text: string; language: string }) {
	const lines = text.split("\n");
	return (
		<div className="rounded border border-line bg-paper">
			<p className="border-b border-line px-2.5 py-1.5 text-[0.8rem] text-ink-soft">
				{name}, {lines.length} {lines.length === 1 ? "line" : "lines"}
			</p>
			{/* The plain text shows at once; the colour arrives when the grammar has loaded. */}
			<Suspense fallback={<NumberedLines lines={lines} />}>
				<HighlightedLines text={text} lines={lines} language={language} />
			</Suspense>
		</div>
	);
}

/** The two panels of a code approval, from `ayoExecuteParts`. */
export function ApprovalCode({ params, code }: { params: string; code: string }) {
	return (
		<div className="grid gap-2">
			<CodePanel name="JavaScript" text={code} language="javascript" />
			{params === "none" ? (
				<p className="text-[0.9rem] text-ink-soft">No params</p>
			) : (
				<CodePanel name="Params" text={params} language="json" />
			)}
		</div>
	);
}

/** The card of a question from Phoebe: the question and what belongs to it, without the answers. */
export function ApprovalCard({
	approval,
	className,
	children,
}: {
	approval: Pick<ApprovalQuestion, "question" | "detail">;
	className?: string;
	children?: ReactNode;
}) {
	return (
		<div className={cn("grid gap-3 rounded-card border border-float-line bg-float px-4 py-3.5 shadow-float", className)}>
			<div className="grid gap-1">
				<p className="flex items-center gap-1.5 text-[0.82rem] text-ink-soft">
					<span className="size-1.5 shrink-0 rounded-full bg-star" aria-hidden="true" />
					Phoebe asks
				</p>
				<p className="text-[1.02rem] leading-snug font-semibold">{approval.question}</p>
				{approval.detail && <p className="text-[0.9rem] leading-snug text-ink-soft">{approval.detail}</p>}
			</div>
			{children}
		</div>
	);
}

/**
 * A question from Phoebe with its answers. A question has one option per line, the recommended one
 * first and marked. A code approval shows the code and the params, then its two options as buttons.
 * The last line takes an answer in Oladayo's own words.
 */
export function ApprovalBlock({
	approval,
	onDecide,
	className,
	children,
}: {
	approval: ApprovalQuestion;
	onDecide: (answer: string) => void;
	className?: string;
	/** Shown under the question, for example where the question comes from. */
	children?: ReactNode;
}) {
	function submitOwnAnswer(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		const answer = String(new FormData(form).get("answer") ?? "").trim();
		if (answer === "") return;
		onDecide(answer);
		form.reset();
	}

	return (
		<ApprovalCard approval={approval} className={className}>
			{children}
			{approval.code ? (
				<>
					<ApprovalCode {...ayoExecuteParts(approval.code)} />
					<div className="grid grid-cols-2 gap-2">
						{approval.options.map((option, index) => (
							<Button
								key={option}
								variant={index === 0 ? "respond" : "quiet"}
								className="h-10"
								onClick={() => onDecide(option)}
							>
								{option}
							</Button>
						))}
					</div>
				</>
			) : (
				<ul className="grid gap-1.5" aria-label="Options">
					{approval.options.map((option, index) => (
						<li key={option}>
							<button
								type="button"
								className={cn(
									optionRow,
									index === 0
										? "bg-wash-strong font-medium hover:bg-line-strong focus-visible:bg-line-strong"
										: "border border-line hover:bg-wash focus-visible:bg-wash",
								)}
								onClick={() => onDecide(option)}
							>
								<span className="min-w-0 flex-1">{option}</span>
								{/* The model puts the option it recommends first. */}
								{index === 0 && (
									<span className="shrink-0 rounded-full bg-star-wash px-2 py-0.5 text-[0.75rem] font-normal text-ink-soft">
										Recommended
									</span>
								)}
							</button>
						</li>
					))}
				</ul>
			)}
			<form onSubmit={submitOwnAnswer} className="relative">
				<Input
					name="answer"
					placeholder={approval.code ? "Or tell Phoebe what to change" : "Or answer in your own words"}
					aria-label="Your own answer"
					autoComplete="off"
					maxLength={500}
					className="h-10 pr-11 touch:pr-12"
				/>
				<Button
					type="submit"
					variant="quiet"
					icon
					aria-label="Send your answer"
					className="absolute top-1 right-1 touch:top-0 touch:right-0"
				>
					<HugeiconsIcon icon={ArrowUp01Icon} size={18} strokeWidth={2} />
				</Button>
			</form>
		</ApprovalCard>
	);
}
