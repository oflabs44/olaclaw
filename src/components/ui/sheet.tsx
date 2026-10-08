import { Drawer as SheetPrimitive } from "@base-ui/react/drawer";
import { cn } from "cn";

/** `swipeDirection` is the side the sheet leaves to: "left" for the drawer, "down" (the default) for a bottom sheet. */
function Sheet({ ...props }: SheetPrimitive.Root.Props) {
	return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
	return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
	return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

/**
 * A drawer from the left, or a bottom sheet within reach of a thumb. Paper, no chrome.
 * It follows the finger and closes on a swipe towards its edge.
 */
function SheetContent({ className, children, ...props }: SheetPrimitive.Popup.Props) {
	return (
		<SheetPrimitive.Portal>
			<SheetPrimitive.Backdrop
				data-slot="sheet-overlay"
				className="fixed inset-0 z-50 bg-scrim opacity-[calc(1-var(--drawer-swipe-progress))] transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0 data-swiping:duration-0"
			/>
			<SheetPrimitive.Viewport className="fixed inset-0 z-50">
				<SheetPrimitive.Popup
					data-slot="sheet-content"
					className={cn(
						"fixed flex touch-auto flex-col overscroll-contain bg-paper text-ink outline-none transition-transform",
						"data-swiping:duration-0 data-swiping:select-none",
						"data-[swipe-direction=left]:inset-y-0 data-[swipe-direction=left]:left-0 data-[swipe-direction=left]:w-[min(19rem,84vw)]",
						"data-[swipe-direction=left]:overflow-y-auto data-[swipe-direction=left]:[transform:translateX(var(--drawer-swipe-movement-x))]",
						"data-[swipe-direction=left]:data-starting-style:-translate-x-full data-[swipe-direction=left]:data-ending-style:-translate-x-full",
						"data-[swipe-direction=down]:inset-x-0 data-[swipe-direction=down]:bottom-0 data-[swipe-direction=down]:h-[min(82dvh,40rem)] data-[swipe-direction=down]:rounded-t-[16px]",
						"data-[swipe-direction=down]:[transform:translateY(var(--drawer-swipe-movement-y))]",
						"data-[swipe-direction=down]:data-starting-style:translate-y-full data-[swipe-direction=down]:data-ending-style:translate-y-full",
						className,
					)}
					{...props}
				>
					{children}
				</SheetPrimitive.Popup>
			</SheetPrimitive.Viewport>
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

export { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger };
