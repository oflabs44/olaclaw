import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
	return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
	return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
	return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogContent({ className, children, ...props }: DialogPrimitive.Popup.Props) {
	return (
		<DialogPrimitive.Portal>
			<DialogPrimitive.Backdrop
				data-slot="dialog-overlay"
				className="fixed inset-0 z-50 bg-scrim transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0"
			/>
			<DialogPrimitive.Popup
				data-slot="dialog-content"
				className={cn(
					"fixed top-[12vh] left-1/2 z-50 grid w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 gap-3",
					"rounded-[12px] border border-float-line bg-float p-3 text-ink shadow-float outline-none",
					"transition-[opacity,translate] data-ending-style:-translate-y-1.5 data-ending-style:opacity-0",
					"data-starting-style:-translate-y-1.5 data-starting-style:opacity-0",
					className,
				)}
				{...props}
			>
				{children}
			</DialogPrimitive.Popup>
		</DialogPrimitive.Portal>
	);
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
	return (
		<DialogPrimitive.Title
			data-slot="dialog-title"
			className={cn("text-md font-semibold", className)}
			{...props}
		/>
	);
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
	return (
		<DialogPrimitive.Description
			data-slot="dialog-description"
			className={cn("text-md text-ink-soft", className)}
			{...props}
		/>
	);
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger };
