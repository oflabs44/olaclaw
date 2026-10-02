import { Select as SelectPrimitive } from "@base-ui/react/select";
import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "cn";

const Select = SelectPrimitive.Root;

function SelectValue({ ...props }: SelectPrimitive.Value.Props) {
	return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

/** A ghost pill, like the toolbar buttons next to it. */
function SelectTrigger({ className, children, ...props }: SelectPrimitive.Trigger.Props) {
	return (
		<SelectPrimitive.Trigger
			data-slot="select-trigger"
			className={cn(
				"inline-flex h-8 cursor-pointer items-center gap-1 rounded-full px-3 text-[13.5px] font-medium",
				"whitespace-nowrap text-ink-soft transition-colors outline-none select-none hover:bg-wash hover:text-ink",
				"data-popup-open:bg-wash data-popup-open:text-ink touch:h-10",
				className,
			)}
			{...props}
		>
			{children}
			<SelectPrimitive.Icon
				render={<HugeiconsIcon icon={ArrowDown01Icon} size={14} strokeWidth={1.5} className="opacity-60" />}
			/>
		</SelectPrimitive.Trigger>
	);
}

function SelectContent({ className, children, ...props }: SelectPrimitive.Popup.Props) {
	return (
		<SelectPrimitive.Portal>
			<SelectPrimitive.Positioner sideOffset={6} alignItemWithTrigger={false} className="z-50 outline-none">
				<SelectPrimitive.Popup
					data-slot="select-content"
					className={cn(
						"min-w-44 origin-(--transform-origin) rounded border border-float-line bg-float p-1 text-ink shadow-float",
						"transition-[opacity,scale] data-ending-style:scale-95 data-ending-style:opacity-0",
						"data-starting-style:scale-95 data-starting-style:opacity-0",
						className,
					)}
					{...props}
				>
					<SelectPrimitive.List>{children}</SelectPrimitive.List>
				</SelectPrimitive.Popup>
			</SelectPrimitive.Positioner>
		</SelectPrimitive.Portal>
	);
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
	return (
		<SelectPrimitive.Item
			data-slot="select-item"
			className={cn(
				"relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2.5 text-md outline-none select-none",
				"data-highlighted:bg-wash touch:min-h-10",
				className,
			)}
			{...props}
		>
			<SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
			<SelectPrimitive.ItemIndicator className="absolute right-2 flex">
				<HugeiconsIcon icon={Tick02Icon} size={16} strokeWidth={1.5} />
			</SelectPrimitive.ItemIndicator>
		</SelectPrimitive.Item>
	);
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
