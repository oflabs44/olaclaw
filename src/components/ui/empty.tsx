import { cn } from "cn";

function Empty({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty"
			className={cn(
				"flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-balance",
				className,
			)}
			{...props}
		/>
	);
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty-header"
			className={cn("flex max-w-sm flex-col items-center gap-1.5", className)}
			{...props}
		/>
	);
}

function EmptyMedia({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty-icon"
			className={cn(
				"mb-1 flex size-9 items-center justify-center rounded bg-wash text-ink-soft [&_svg]:size-[18px]",
				className,
			)}
			{...props}
		/>
	);
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"h2">) {
	return (
		<h2 data-slot="empty-title" className={cn("text-lg font-semibold", className)} {...props} />
	);
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p data-slot="empty-description" className={cn("text-md text-ink-soft", className)} {...props} />
	);
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty-content"
			className={cn("flex w-full max-w-sm min-w-0 flex-col items-center gap-2.5", className)}
			{...props}
		/>
	);
}

export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia };
