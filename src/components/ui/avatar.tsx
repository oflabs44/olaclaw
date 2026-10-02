import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import { cn } from "cn";

function Avatar({ className, ...props }: AvatarPrimitive.Root.Props) {
	return (
		<AvatarPrimitive.Root
			data-slot="avatar"
			className={cn("relative flex size-7 shrink-0 overflow-hidden rounded-full select-none", className)}
			{...props}
		/>
	);
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
	return (
		<AvatarPrimitive.Image
			data-slot="avatar-image"
			className={cn("size-full object-cover", className)}
			{...props}
		/>
	);
}

function AvatarFallback({ className, ...props }: AvatarPrimitive.Fallback.Props) {
	return (
		<AvatarPrimitive.Fallback
			data-slot="avatar-fallback"
			className={cn(
				"flex size-full items-center justify-center bg-wash-strong text-sm font-semibold text-ink",
				className,
			)}
			{...props}
		/>
	);
}

export { Avatar, AvatarImage, AvatarFallback };
