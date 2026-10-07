import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_MODEL, MODELS } from "@/models";

export const Route = createFileRoute("/phoebe/models")({
	component: ModelsTab,
});

/** The models a chat can run on. Each chat picks its own in the composer. */
function ModelsTab() {
	return (
		<ul className="grid">
			{MODELS.map((model) => (
				<li
					key={model.id}
					className="flex items-baseline gap-6 border-b border-line py-[0.6rem] first:pt-0 last:border-b-0 max-wide:min-h-11"
				>
					<div className="min-w-0 flex-1">
						<p>{model.label}</p>
						<p className="text-[13px] text-ink-soft">{model.note}</p>
					</div>
					{model.id === DEFAULT_MODEL && <p className="shrink-0 text-[13px] text-ink-soft">Default for new chats</p>}
				</li>
			))}
		</ul>
	);
}
