export type ModelId = "claude-sonnet-5-5" | "claude-opus-5-5" | "kimi-k2.7";

export const MODELS: readonly { id: ModelId; label: string; note: string }[] = [
	{ id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "Fast, strong judgment." },
	{ id: "claude-opus-5-5", label: "Claude Opus 5.5", note: "Hardest reasoning. Slower, costs more." },
	{ id: "kimi-k2.7", label: "Kimi K2.7", note: "Workers AI, included in the plan. Weaker with tools." },
];

export const DEFAULT_MODEL: ModelId = "claude-sonnet-5-5";
