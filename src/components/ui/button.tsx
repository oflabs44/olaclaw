import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cn } from "cn";

// Bureau's button: a 32px pill (40px on touch). The focus ring is the global :focus-visible outline.
const base =
	"inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full px-3.5 " +
	"text-[13.5px] font-medium whitespace-nowrap transition-colors select-none touch:h-10 " +
	"data-disabled:cursor-default data-disabled:opacity-35 [&_svg]:pointer-events-none [&_svg]:shrink-0";

const variants = {
	/** No surface: toolbar and row actions, which sit on paper until hovered. */
	ghost: "text-ink-soft hover:bg-wash hover:text-ink data-disabled:hover:bg-transparent",
	/** The one main action on a screen. */
	primary: "chip-primary",
	/** The same dimensional pill in ink, for everything that is not the main action. */
	quiet: "chip-quiet",
	/** Respond / positive, the only place --accent appears. */
	respond: "chip-respond",
};

type ButtonProps = ButtonPrimitive.Props & {
	variant?: keyof typeof variants;
	/** Square button holding a single icon; give it an aria-label. */
	icon?: boolean;
};

function Button({ variant = "ghost", icon, className, ...props }: ButtonProps) {
	return (
		<ButtonPrimitive
			data-slot="button"
			className={cn(base, variants[variant], icon && "size-8 p-0 touch:size-10", className)}
			{...props}
		/>
	);
}

export { Button, type ButtonProps };
