import { bindings, defineConfig, exports } from "cf/config";
import * as entrypoint from "./src/server.ts" with { type: "cf-worker" };

export default defineConfig({
	worker: {
		name: "olaclaw",
		compatibilityDate: "2026-09-25",
		compatibilityFlags: ["nodejs_compat"],
		entrypoint,
		// Cloudflare Access protects only the custom domain, so every other URL stays off.
		domains: ["claw.fagbemi.me"],
		workersDev: false,
		previewUrls: false,
		exports: {
			PiAgent: exports.durableObject({ storage: "sqlite" }),
		},
		env: {
			AI: bindings.ai({ dev: { remote: true } }),
		},
	},
});
