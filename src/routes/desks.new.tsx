import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { DeskForm } from "@/components/workspace/desk-form";
import { PageHeader } from "@/components/workspace/page-header";
import type { DeskInput } from "@/desks";
import { createDesk } from "@/workspace-data";

export const Route = createFileRoute("/desks/new")({
	staticData: { section: "New desk" },
	component: NewDeskPage,
});

const EMPTY_DESK: DeskInput = { name: "", brief: "", hue: "blue", icon: "mail" };

function NewDeskPage() {
	const router = useRouter();
	const navigate = useNavigate();

	async function create(input: DeskInput) {
		const desk = await createDesk({ data: input });
		await router.invalidate();
		await navigate({ to: "/desks/$deskId", params: { deskId: desk.id }, search: true });
	}

	return (
		<>
			<PageHeader title="New desk" />
			<div className="overflow-y-auto">
				<DeskForm desk={EMPTY_DESK} submitLabel="Create desk" save={create} />
			</div>
		</>
	);
}
