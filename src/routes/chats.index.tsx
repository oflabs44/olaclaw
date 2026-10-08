import { createFileRoute } from "@tanstack/react-router";
import { DeskHome } from "@/components/workspace/desk-home";
import { GENERAL_DESK_NAME, GeneralDeskIcon } from "@/components/workspace/general-desk";

export const Route = createFileRoute("/chats/")({
	staticData: { section: GENERAL_DESK_NAME },
	component: GeneralDeskPage,
});

/** The page of the General desk. It has nothing to set, so its name leads nowhere. */
function GeneralDeskPage() {
	return (
		<DeskHome
			deskId={null}
			placeholder="New chat"
			header={
				<h1 className="flex min-w-0 items-center gap-3 py-1 text-[22px] leading-[1.3] font-semibold tracking-[-0.01em] max-wide:min-h-11">
					<GeneralDeskIcon size={22} />
					{GENERAL_DESK_NAME}
				</h1>
			}
		/>
	);
}
