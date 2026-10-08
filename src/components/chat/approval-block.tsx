import { ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "cn";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ApprovalQuestion = {
	readonly question: string;
	readonly detail?: string;
	readonly options: readonly string[];
};

const optionRow =
	"flex min-h-11 w-full cursor-pointer items-center gap-3 rounded px-3 py-2 text-left text-[0.95rem] " +
	"transition-colors touch:min-h-12";

/**
 * A question from Phoebe with its answers: one option per line, the recommended one first and marked.
 * The last line takes an answer in Oladayo's own words.
 */
export function ApprovalBlock({ approval, onDecide }: { approval: ApprovalQuestion; onDecide: (answer: string) => void }) {
	function submitOwnAnswer(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		const answer = String(new FormData(form).get("answer") ?? "").trim();
		if (answer === "") return;
		onDecide(answer);
		form.reset();
	}

	return (
		<div className="grid gap-3 rounded-card border border-float-line bg-float px-4 py-3.5 shadow-float">
			<div className="grid gap-1">
				<p className="flex items-center gap-1.5 text-[0.82rem] text-ink-soft">
					<span className="size-1.5 shrink-0 rounded-full bg-star" aria-hidden="true" />
					Phoebe asks
				</p>
				<p className="text-[1.02rem] leading-snug font-semibold">{approval.question}</p>
				{approval.detail && <p className="text-[0.9rem] leading-snug whitespace-pre-wrap text-ink-soft">{approval.detail}</p>}
			</div>
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
			<form onSubmit={submitOwnAnswer} className="relative">
				<Input
					name="answer"
					placeholder="Or answer in your own words"
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
		</div>
	);
}
