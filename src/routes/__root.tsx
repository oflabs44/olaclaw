import {
	createRootRoute,
	type ErrorComponentProps,
	HeadContent,
	Link,
	Outlet,
	retainSearchParams,
	Scripts,
	useLoaderData,
	useRouter,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { z } from "zod";
import { Chrome } from "@/components/workspace/chrome";
import { Omnibox } from "@/components/workspace/omnibox";
import { PageHeader } from "@/components/workspace/page-header";
import { LeftPane, NowPane } from "@/components/workspace/panes";
import { WorkspaceKeys } from "@/components/workspace/workspace-keys";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PiSessionProvider } from "@/pi-session";
import appCss from "@/styles.css?url";
import { getThemePreference, SYSTEM_THEME_SCRIPT } from "@/theme";
import { getChats, getNowPanel } from "@/workspace-data";

declare module "@tanstack/react-router" {
	interface StaticDataRouteOption {
		/** The workspace section a route belongs to, shown in the omni trigger. */
		section?: string;
	}
}

// Panel and omnibox state is navigation state, so it lives in the URL. Absent panel params mean
// the device default (see components/workspace/panels.ts).
const workspaceSearch = z.object({
	left: z.enum(["open", "closed"]).optional().catch(undefined),
	right: z.enum(["open", "closed"]).optional().catch(undefined),
	omni: z.boolean().optional().catch(undefined),
});

export type WorkspaceSearch = z.infer<typeof workspaceSearch>;

export const Route = createRootRoute({
	validateSearch: workspaceSearch,
	search: { middlewares: [retainSearchParams(["left", "right"])] },
	loader: async () => {
		const [theme, chats, now] = await Promise.all([getThemePreference(), getChats(), getNowPanel()]);
		return { theme, chats, now };
	},
	// Chats and the Now panel are static placeholders today, so only a theme change (router.invalidate)
	// needs a fresh root load. Revisit when they hold real data.
	staleTime: Number.POSITIVE_INFINITY,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
			{ title: "olaclaw" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
		scripts: [{ children: SYSTEM_THEME_SCRIPT }],
	}),
	shellComponent: RootDocument,
	component: Workspace,
	notFoundComponent: NotFound,
	errorComponent: LoadFailed,
});

function RootDocument({ children }: { children: ReactNode }) {
	// The loader data is missing when the root loader failed; the error component then renders inside this shell.
	const theme = useLoaderData({ from: "__root__", select: (data) => data?.theme ?? "system" });
	return (
		// The head script sets data-theme before hydration when the theme follows the system.
		<html lang="en" data-theme={theme === "system" ? undefined : theme} suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}

/**
 * The chrome strip on wide screens, then the stage: left pane, the card with the page, Now pane.
 * Phones drop the chrome and the card frame; the panes become a drawer and a bottom sheet.
 */
function Workspace() {
	return (
		<PiSessionProvider>
			<TooltipProvider>
				<Toaster>
					<div className="grid h-dvh grid-rows-[minmax(0,1fr)] overflow-hidden bg-paper wide:grid-rows-[auto_minmax(0,1fr)] wide:bg-chrome">
						<Chrome />
						<div className="flex min-h-0 min-w-0 bg-paper wide:mx-1.5 wide:gap-2.5 wide:rounded-t-card wide:px-2.5 wide:pt-2.5">
							<LeftPane />
							<main className="flex min-w-0 flex-1 flex-col bg-sheet max-wide:bg-paper wide:rounded-t-card wide:border wide:border-b-0 wide:border-line wide:shadow-float">
								<Outlet />
							</main>
							<NowPane />
						</div>
					</div>
					<Omnibox />
					<WorkspaceKeys />
				</Toaster>
			</TooltipProvider>
		</PiSessionProvider>
	);
}

function LoadFailed({ error }: ErrorComponentProps) {
	const router = useRouter();
	return (
		<Empty className="min-h-dvh">
			<EmptyHeader>
				<EmptyTitle>olaclaw could not load</EmptyTitle>
				<EmptyDescription>{error instanceof Error ? error.message : String(error)}</EmptyDescription>
			</EmptyHeader>
			<Button variant="quiet" onClick={() => router.invalidate()}>
				Try again
			</Button>
		</Empty>
	);
}

function NotFound() {
	return (
		<>
			<PageHeader title="Not found" />
			<Empty>
				<EmptyHeader>
					<EmptyTitle>Nothing here</EmptyTitle>
					<EmptyDescription>
						This page does not exist. Go to{" "}
						<Link to="/" className="underline underline-offset-4">
							Today
						</Link>
						.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		</>
	);
}
