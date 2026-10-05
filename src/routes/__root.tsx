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
import { ApprovalsPane, LeftPane } from "@/components/workspace/panes";
import { WorkspaceKeys } from "@/components/workspace/workspace-keys";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useKeyboardViewport } from "@/lib/use-keyboard-viewport";
import appCss from "@/styles.css?url";
import { getThemePreference, SYSTEM_THEME_SCRIPT, type ThemePreference } from "@/theme";
import { getApprovals, getAyoConnection, getChats } from "@/workspace-data";

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
	/** The decided approval that is open in full: the id of its tool call. */
	approval: z.string().optional().catch(undefined),
});

export type WorkspaceSearch = z.infer<typeof workspaceSearch>;

// --paper of each theme (tokens.css), so the browser bar and the status bar blend with the header.
const PAPER = { light: "#fafafa", dark: "#0e0f11" };

// Not in the route's `head`: that keeps one meta per name, and the system theme needs two.
function ThemeColorMeta({ theme }: { theme: ThemePreference }) {
	if (theme !== "system") return <meta name="theme-color" content={PAPER[theme]} />;
	return (
		<>
			<meta name="theme-color" content={PAPER.light} media="(prefers-color-scheme: light)" />
			<meta name="theme-color" content={PAPER.dark} media="(prefers-color-scheme: dark)" />
		</>
	);
}

export const Route = createRootRoute({
	validateSearch: workspaceSearch,
	search: { middlewares: [retainSearchParams(["left", "right"])] },
	loader: async () => {
		const [theme, chats, approvals, isAyoConnected] = await Promise.all([
			getThemePreference(),
			getChats(),
			getApprovals(),
			// A status dot must not break the app when Ayo or the MCP client fails.
			getAyoConnection().catch(() => false),
		]);
		return { theme, chats, approvals, isAyoConnected };
	},
	// This tab invalidates after its own chat changes. After 30 s the next navigation reloads, which
	// picks up chats made on other devices.
	staleTime: 30_000,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				// interactive-widget: the layout shrinks with the keyboard where the browser supports it.
				content: "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
			},
			{ title: "Phoebe" },
			{ name: "apple-mobile-web-app-capable", content: "yes" },
			{ name: "mobile-web-app-capable", content: "yes" },
			{ name: "apple-mobile-web-app-title", content: "Phoebe" },
			// The page draws under the status bar; the header pads itself with the safe-area inset.
			{ name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			// Cloudflare Access answers a manifest request without cookies with its login page.
			{ rel: "manifest", href: "/manifest.webmanifest", crossOrigin: "use-credentials" },
			{ rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
			{ rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
		],
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
				<ThemeColorMeta theme={theme} />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}

/**
 * The chrome strip on wide screens, then the stage: left pane, the card with the page, approvals pane.
 * Phones drop the chrome and the card frame; the panes become a drawer and a bottom sheet.
 */
function Workspace() {
	useKeyboardViewport();
	return (
		<TooltipProvider>
			<Toaster>
				<div className="grid h-(--viewport-height,100dvh) grid-rows-[minmax(0,1fr)] overflow-hidden bg-paper wide:grid-rows-[auto_minmax(0,1fr)] wide:bg-chrome">
					<Chrome />
					<div className="flex min-h-0 min-w-0 bg-paper wide:mx-1.5 wide:gap-2.5 wide:rounded-t-card wide:px-2.5 wide:pt-2.5">
						<LeftPane />
						<main className="flex min-w-0 flex-1 flex-col bg-sheet max-wide:bg-paper wide:rounded-t-card wide:border wide:border-b-0 wide:border-line wide:shadow-float">
							<Outlet />
						</main>
						<ApprovalsPane />
					</div>
				</div>
				<Omnibox />
				<WorkspaceKeys />
			</Toaster>
		</TooltipProvider>
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
