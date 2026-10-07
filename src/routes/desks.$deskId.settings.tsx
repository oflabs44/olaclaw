import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router";
import { toast } from "@/components/ui/toast";
import { DeskForm } from "@/components/workspace/desk-form";
import { DeskNotes } from "@/components/workspace/desk-notes";
import { PageHeader } from "@/components/workspace/page-header";
import type { DeskInput } from "@/desks";
import { updateDesk } from "@/workspace-data";

export const Route = createFileRoute("/desks/$deskId/settings")({
	staticData: { section: "Settings" },
	component: DeskSettingsPage,
});

const deskRoute = getRouteApi("/desks/$deskId");

/** What Oladayo sets for a desk, and under it the notebook that Phoebe keeps there, newest first. */
function DeskSettingsPage() {
	const desk = deskRoute.useLoaderData({ select: (data) => data.desk });
	const notes = deskRoute.useLoaderData({ select: (data) => data.notes });
	const router = useRouter();

	async function save(input: DeskInput) {
		await updateDesk({ data: { deskId: desk.id, ...input } });
		await router.invalidate();
		toast.add({ title: "Saved" });
	}

	return (
		<>
			<PageHeader title="Settings" subtitle={desk.name} />
			<div className="overflow-y-auto">
				{/* The fields keep their own state, so another desk needs a new form. */}
				<DeskForm key={desk.id} desk={desk} submitLabel="Save" save={save} />
				<section className="mx-auto grid w-full max-w-[44rem] gap-1.5 px-6 pt-2 pb-8 text-[15px] max-wide:px-4 max-wide:text-[16px]">
					<h2 className="text-[13px] font-normal text-ink-soft">
						Notebook
					</h2>
					{notes.length === 0 ? (
						<p className="text-ink-soft">Phoebe writes here what she must keep between chats at this desk.</p>
					) : (
						<DeskNotes deskId={desk.id} notes={notes.toReversed()} />
					)}
				</section>
			</div>
		</>
	);
}
