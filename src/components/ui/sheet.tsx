import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
	return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
	return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

/** A drawer from the left, or a bottom sheet within reach of a thumb. Paper, no chrome. */
function SheetContent({
	className,
	children,
	side = "left",
	...props
}: SheetPrimitive.Popup.Props & { side?: "left" | "bottom" }) {
	return (
		<SheetPrimitive.Portal>
			<SheetPrimitive.Backdrop
				data-slot="sheet-overlay"
				className="fixed inset-0 z-50 bg-scrim transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0"
			/>
			<SheetPrimitive.Popup
				data-slot="sheet-content"
				data-side={side}
				className={cn(
					"fixed z-50 flex flex-col bg-paper text-ink outline-none transition-transform",
					"data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:w-[min(19rem,84vw)]",
					"data-[side=left]:data-starting-style:-translate-x-full data-[side=left]:data-ending-style:-translate-x-full",
					"data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-[min(82dvh,40rem)] data-[side=bottom]:rounded-t-[16px]",
					"data-[side=bottom]:data-starting-style:translate-y-full data-[side=bottom]:data-ending-style:translate-y-full",
					className,
				)}
				{...props}
			>
				{children}
			</SheetPrimitive.Popup>
		</SheetPrimitive.Portal>
	);
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
	return (
		<SheetPrimitive.Title
			data-slot="sheet-title"
			className={cn("text-[0.95rem] font-semibold", className)}
			{...props}
		/>
	);
}

export { Sheet, SheetClose, SheetContent, SheetTitle };
