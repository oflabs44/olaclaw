import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "cn";

function TooltipProvider({ delay = 400, ...props }: TooltipPrimitive.Provider.Props) {
	return <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props} />;
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
	return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
	return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
	className,
	side = "top",
	sideOffset = 6,
	children,
	...props
}: TooltipPrimitive.Popup.Props & Pick<TooltipPrimitive.Positioner.Props, "side" | "sideOffset">) {
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Positioner side={side} sideOffset={sideOffset} className="z-50">
				<TooltipPrimitive.Popup
					data-slot="tooltip-content"
					className={cn(
						"inline-flex items-center gap-1.5 rounded-sm bg-ink px-2 py-1 text-sm font-medium text-paper",
						"transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0",
						className,
					)}
					{...props}
				>
					{children}
				</TooltipPrimitive.Popup>
			</TooltipPrimitive.Positioner>
		</TooltipPrimitive.Portal>
	);
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
