import type { CodeHighlighterPlugin, HighlightResult } from "@streamdown/code";
import type { BundledLanguage, HighlighterCore } from "shiki";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import githubDark from "shiki/dist/themes/github-dark.mjs";
import githubLight from "shiki/dist/themes/github-light.mjs";

// Streamdown's own code plugin ships every Shiki theme and grammar as a lazy chunk, which put
// 300 files in the deploy. This plugin loads one theme pair and the JavaScript family only; any
// other language renders as plain text.
const THEMES = { light: "github-light", dark: "github-dark" } as const;
const LANGUAGES: Record<string, () => Promise<{ default: unknown }>> = {
	javascript: () => import("shiki/dist/langs/javascript.mjs"),
	typescript: () => import("shiki/dist/langs/typescript.mjs"),
	jsx: () => import("shiki/dist/langs/jsx.mjs"),
	tsx: () => import("shiki/dist/langs/tsx.mjs"),
};
const ALIASES: Record<string, string> = { js: "javascript", ts: "typescript", mjs: "javascript", cjs: "javascript" };

function resolveLanguage(language: string): string {
	const name = language.trim().toLowerCase();
	const resolved = ALIASES[name] ?? name;
	return resolved in LANGUAGES ? resolved : "text";
}

let highlighter: Promise<HighlighterCore> | undefined;

function loadHighlighter(): Promise<HighlighterCore> {
	highlighter ??= (async () => {
		const grammars = await Promise.all(Object.values(LANGUAGES).map((load) => load()));
		return createHighlighterCore({
			themes: [githubLight, githubDark],
			// Grammar modules default-export a registration array, which Shiki accepts as a language input.
			langs: grammars.map((grammar) => grammar.default as never),
			engine: createJavaScriptRegexEngine({ forgiving: true }),
		});
	})();
	return highlighter;
}

// Finished blocks are highlighted once; a block that is still streaming is recomputed on each delta.
const completed = new Map<string, HighlightResult>();
const CACHE_LIMIT = 500;

export const codeHighlighter: CodeHighlighterPlugin = {
	name: "shiki",
	type: "code-highlighter",
	getThemes: () => [THEMES.light, THEMES.dark],
	getSupportedLanguages: () => Object.keys(LANGUAGES) as BundledLanguage[],
	supportsLanguage: (language) => resolveLanguage(language) !== "text",
	highlight({ code, language, isIncomplete = false }, callback) {
		const lang = resolveLanguage(language);
		const key = `${lang}\n${code}`;
		const cached = completed.get(key);
		if (cached) return cached;
		loadHighlighter()
			.then((core) => {
				const result = core.codeToTokens(code, { lang, themes: THEMES });
				if (!isIncomplete) {
					if (completed.size >= CACHE_LIMIT) completed.delete(completed.keys().next().value as string);
					completed.set(key, result);
				}
				callback?.(result);
			})
			.catch((error) => console.error("Code highlighting failed", error));
		return null;
	},
};
