import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";

/** Show a toast from anywhere: `toast.add({ title: "Copied" })`. */
const toast = ToastPrimitive.createToastManager();

function ToastList() {
	const { toasts } = ToastPrimitive.useToastManager();
	return toasts.map((item) => (
		<ToastPrimitive.Root
			key={item.id}
			toast={item}
			className="flex items-center gap-3 rounded border border-float-line bg-float py-2 pr-1.5 pl-3.5 text-ink shadow-float transition-[opacity,translate] data-ending-style:translate-y-2 data-ending-style:opacity-0 data-starting-style:translate-y-2 data-starting-style:opacity-0"
		>
			<ToastPrimitive.Content className="min-w-0 flex-1">
				<ToastPrimitive.Title className="text-md font-medium" />
				<ToastPrimitive.Description className="text-md text-ink-soft" />
			</ToastPrimitive.Content>
			<ToastPrimitive.Close render={<Button icon aria-label="Close" />}>
				<HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={1.5} />
			</ToastPrimitive.Close>
		</ToastPrimitive.Root>
	));
}

function Toaster({ children }: { children: React.ReactNode }) {
	return (
		<ToastPrimitive.Provider toastManager={toast} limit={3}>
			{children}
			<ToastPrimitive.Portal>
				<ToastPrimitive.Viewport className="fixed right-4 bottom-4 z-50 flex w-[min(22rem,calc(100%-2rem))] flex-col gap-2 outline-none">
					<ToastList />
				</ToastPrimitive.Viewport>
			</ToastPrimitive.Portal>
		</ToastPrimitive.Provider>
	);
}

export { Toaster, toast };
