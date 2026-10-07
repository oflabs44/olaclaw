import { bindings, defineConfig, exports } from "cf/config";
import * as entrypoint from "./src/server.ts" with { type: "cf-worker" };

export default defineConfig({
	worker: {
		name: "olaclaw",
		compatibilityDate: "2026-09-25",
		compatibilityFlags: ["nodejs_compat"],
		entrypoint,
		// Cloudflare Access protects only the custom domain, so every other URL stays off.
		domains: ["ai.fagbemi.me"],
		workersDev: false,
		previewUrls: false,
		exports: {
			PiAgent: exports.durableObject({ storage: "sqlite" }),
		},
		env: {
			AI: bindings.ai({ dev: { remote: true } }),
			// The admin entrypoint of each mycloud mail tenant. `cf dev` reaches the production Workers too.
			MAIL_ADMIN: bindings.worker({ worker: "mycloud-mail", exportName: "MailAdmin", dev: { remote: true } }),
			MAIL_ADMIN_GETU: bindings.worker({ worker: "mycloud-mail-getu", exportName: "MailAdmin", dev: { remote: true } }),
		},
	},
});
