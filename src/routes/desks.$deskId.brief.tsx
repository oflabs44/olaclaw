import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router";
import { toast } from "@/components/ui/toast";
import { DeskForm } from "@/components/workspace/desk-form";
import { PageHeader } from "@/components/workspace/page-header";
import type { DeskInput } from "@/desks";
import { updateDesk } from "@/workspace-data";

export const Route = createFileRoute("/desks/$deskId/brief")({
	staticData: { section: "Brief" },
	component: DeskBriefPage,
});

const deskRoute = getRouteApi("/desks/$deskId");

function DeskBriefPage() {
	const desk = deskRoute.useLoaderData({ select: (data) => data.desk });
	const router = useRouter();

	async function save(input: DeskInput) {
		await updateDesk({ data: { deskId: desk.id, ...input } });
		await router.invalidate();
		toast.add({ title: "Saved" });
	}

	return (
		<>
			<PageHeader title="Brief" subtitle={desk.name} />
			<div className="overflow-y-auto">
				{/* The fields keep their own state, so another desk needs a new form. */}
				<DeskForm key={desk.id} desk={desk} submitLabel="Save" save={save} />
			</div>
		</>
	);
}
