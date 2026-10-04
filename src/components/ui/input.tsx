import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "cn";

function Input({ className, ...props }: InputPrimitive.Props) {
	return (
		<InputPrimitive
			data-slot="input"
			className={cn(
				"h-8 w-full min-w-0 rounded-full border border-line-strong bg-sheet px-3.5 text-md transition-colors",
				"outline-none placeholder:text-ink-faint focus:border-primary touch:h-11 touch:text-[16px]",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
