import { cn } from "cn";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { Approval } from "@/workspace-data";

export type ApprovalQuestion = Pick<Approval, "question" | "detail" | "options">;

export function ApprovalBlock({
	approval,
	onDecide,
	className,
	children,
}: {
	approval: ApprovalQuestion;
	onDecide: (option: string) => void;
	className?: string;
	/** Shown between the question and the options, for example where the question comes from. */
	children?: ReactNode;
}) {
	return (
		<div className={cn("grid gap-2 rounded bg-star-wash px-[0.9rem] py-[0.8rem]", className)}>
			<p className="font-semibold">
				{approval.question}
				{approval.detail && <q className="block font-normal text-ink-soft">{approval.detail}</q>}
			</p>
			{children}
			<div className="flex flex-wrap gap-2">
				{approval.options.map((option, index) => (
					// The model puts the option it recommends first.
					<Button key={option} variant={index === 0 ? "respond" : "quiet"} onClick={() => onDecide(option)}>
						{option}
					</Button>
				))}
			</div>
		</div>
	);
}
