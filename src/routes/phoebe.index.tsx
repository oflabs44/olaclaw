import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/phoebe/")({
	beforeLoad: () => {
		throw redirect({ to: "/phoebe/memory", search: true, replace: true });
	},
});
