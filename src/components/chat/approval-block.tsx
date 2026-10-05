import { ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "cn";
import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Approval } from "@/workspace-data";

export type ApprovalQuestion = Pick<Approval, "question" | "detail" | "code" | "options">;

const optionRow =
	"flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[0.6rem] px-3 py-2 text-left text-[0.95rem] " +
	"transition-colors hover:bg-sheet focus-visible:bg-sheet touch:min-h-12";

/**
 * A question from Phoebe, with the code it is about when there is any. The options stand one per line, the recommended one first and marked;
 * the last line takes an answer in Oladayo's own words.
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
		<div
			className={cn(
				"grid gap-3 rounded-[0.9rem] border border-star/30 bg-star-wash px-4 py-3.5 shadow-float",
				className,
			)}
		>
			<div className="grid gap-1">
				<p className="text-[0.72rem] font-semibold tracking-wide text-star uppercase">Phoebe asks</p>
				<p className="text-[1.02rem] leading-snug font-semibold">{approval.question}</p>
				{approval.detail && <p className="text-[0.9rem] leading-snug text-ink-soft">{approval.detail}</p>}
				{approval.code && (
					<pre className="mt-1 max-h-80 overflow-auto rounded bg-sheet px-2.5 py-2 font-mono text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
						{approval.code}
					</pre>
				)}
				{children}
			</div>
			<ul className="grid gap-1 border-t border-star/20 pt-2.5" aria-label="Options">
				{approval.options.map((option, index) => (
					<li key={option}>
						<button
							type="button"
							className={cn(optionRow, index === 0 && "bg-sheet font-medium shadow-sm")}
							onClick={() => onDecide(option)}
						>
							<span
								className={cn(
									"flex size-6 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-semibold",
									index === 0 ? "bg-star text-paper" : "bg-wash text-ink-soft",
								)}
								aria-hidden="true"
							>
								{index + 1}
							</span>
							<span className="min-w-0 flex-1">
								{option}
								{/* The model puts the option it recommends first. A code approval has fixed options. */}
								{index === 0 && !approval.code && <span className="block text-[0.72rem] font-normal text-star">Recommended</span>}
							</span>
						</button>
					</li>
				))}
				<li>
					<form onSubmit={submitOwnAnswer} className="flex items-center gap-2 px-1 pt-1">
						<Input
							name="answer"
							placeholder="Or answer in your own words"
							aria-label="Your own answer"
							autoComplete="off"
							maxLength={500}
							className="h-10 rounded-[0.6rem] bg-sheet touch:h-11"
						/>
						<Button type="submit" variant="respond" icon aria-label="Send your answer" className="size-10 touch:size-11">
							<HugeiconsIcon icon={ArrowUp01Icon} size={18} strokeWidth={2} />
						</Button>
					</form>
				</li>
			</ul>
		</div>
	);
}
