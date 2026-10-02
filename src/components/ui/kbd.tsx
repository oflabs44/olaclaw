import { cn } from "cn";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
	return (
		<kbd
			data-slot="kbd"
			className={cn(
				"pointer-events-none inline-flex h-5 min-w-5 items-center justify-center gap-px rounded-sm bg-wash px-1",
				"font-mono text-[10.5px] text-ink-faint select-none [&_svg]:size-3",
				className,
			)}
			{...props}
		/>
	);
}

export { Kbd };
