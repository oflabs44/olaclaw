import { createFileRoute } from "@tanstack/react-router";
import { getDesk } from "@/workspace-data";

/**
 * The pages of one desk, over the desk and its notebook. The pages read the desk from here, not from
 * the root loader's list, which can be older than the desk. A desk that does not exist is "not found".
 */
export const Route = createFileRoute("/desks/$deskId")({
	loader: ({ params }) => getDesk({ data: { deskId: params.deskId } }),
});
