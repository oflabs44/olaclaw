import type { CodeHighlighterPlugin, HighlightResult } from "@streamdown/code";
import type { BundledLanguage, HighlighterCore, LanguageInput } from "shiki";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import githubDark from "shiki/dist/themes/github-dark.mjs";
import githubLight from "shiki/dist/themes/github-light.mjs";

// Streamdown's own code plugin ships every Shiki theme and grammar as a lazy chunk, which put
// 300 files in the deploy. This plugin ships one theme pair and the grammars below, each as a chunk
// that loads the first time a block needs it; any other language renders as plain text.
// To change the theme pair, change the two imports above and these names together.
export const THEMES = { light: "github-light", dark: "github-dark" } as const;

// Keyed by the grammar's own name. A grammar module brings the grammars it embeds (html brings
// javascript and css), so one import is enough for each.
const LANGUAGES: Record<string, LanguageInput> = {
	javascript: () => import("shiki/dist/langs/javascript.mjs"),
	typescript: () => import("shiki/dist/langs/typescript.mjs"),
	jsx: () => import("shiki/dist/langs/jsx.mjs"),
	tsx: () => import("shiki/dist/langs/tsx.mjs"),
	json: () => import("shiki/dist/langs/json.mjs"),
	shellscript: () => import("shiki/dist/langs/shellscript.mjs"),
	python: () => import("shiki/dist/langs/python.mjs"),
	html: () => import("shiki/dist/langs/html.mjs"),
	css: () => import("shiki/dist/langs/css.mjs"),
	sql: () => import("shiki/dist/langs/sql.mjs"),
	yaml: () => import("shiki/dist/langs/yaml.mjs"),
	go: () => import("shiki/dist/langs/go.mjs"),
	php: () => import("shiki/dist/langs/php.mjs"),
	svelte: () => import("shiki/dist/langs/svelte.mjs"),
	diff: () => import("shiki/dist/langs/diff.mjs"),
	markdown: () => import("shiki/dist/langs/markdown.mjs"),
	toml: () => import("shiki/dist/langs/toml.mjs"),
	docker: () => import("shiki/dist/langs/docker.mjs"),
	rust: () => import("shiki/dist/langs/rust.mjs"),
};
const ALIASES: Record<string, string> = {
	js: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	ts: "typescript",
	bash: "shellscript",
	sh: "shellscript",
	shell: "shellscript",
	zsh: "shellscript",
	console: "shellscript",
	py: "python",
	yml: "yaml",
	golang: "go",
	md: "markdown",
	dockerfile: "docker",
	rs: "rust",
};

function resolveLanguage(language: string): string {
	const name = language.trim().toLowerCase();
	const resolved = ALIASES[name] ?? name;
	return resolved in LANGUAGES ? resolved : "text";
}

let highlighter: Promise<HighlighterCore> | undefined;
const grammars = new Map<string, Promise<void>>();

/** The highlighter, with the grammar of `lang` loaded. `lang` is a result of `resolveLanguage`. */
async function loadHighlighter(lang: string): Promise<HighlighterCore> {
	highlighter ??= createHighlighterCore({
		themes: [githubLight, githubDark],
		engine: createJavaScriptRegexEngine({ forgiving: true }),
	});
	const core = await highlighter;
	const grammar = LANGUAGES[lang];
	if (grammar) {
		let loading = grammars.get(lang);
		if (!loading) {
			// A failed load must not stay cached: the next block tries again.
			loading = core.loadLanguage(grammar).catch((error: unknown) => {
				grammars.delete(lang);
				throw error;
			});
			grammars.set(lang, loading);
		}
		await loading;
	}
	return core;
}

const CACHE_LIMIT = 500;

function remember<Value>(cache: Map<string, Value>, key: string, value: Value) {
	if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
	cache.set(key, value);
}

// Finished blocks are highlighted once; a block that is still streaming is recomputed on each delta.
const completed = new Map<string, HighlightResult>();

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
		loadHighlighter(lang)
			.then((core) => {
				const result = core.codeToTokens(code, { lang, themes: THEMES });
				if (!isIncomplete) remember(completed, key, result);
				callback?.(result);
			})
			.catch((error) => console.error("Code highlighting failed", error));
		return null;
	},
};

export type HighlightedToken = { content: string; color?: string; darkColor?: string };

// Relative luminance of --paper in each theme (src/tokens.css): the surface behind highlighted code.
const PAPER_LUMINANCE = { light: 0.955, dark: 0.005 };
const MIN_CONTRAST = 3;

function channelLuminance(hex: string, start: number): number {
	const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
	return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** The colour when it is plain hex and reads well on paper. Otherwise undefined, and the token takes ink. */
function readableColor(color: string | undefined, paperLuminance: number): string | undefined {
	const hex = color?.match(/^#([0-9a-f]{6})$/i)?.[1];
	if (!hex) return undefined;
	const luminance = 0.2126 * channelLuminance(hex, 0) + 0.7152 * channelLuminance(hex, 2) + 0.0722 * channelLuminance(hex, 4);
	const contrast = (Math.max(luminance, paperLuminance) + 0.05) / (Math.min(luminance, paperLuminance) + 0.05);
	return contrast >= MIN_CONTRAST ? color : undefined;
}

const highlightedLines = new Map<string, Promise<HighlightedToken[][] | null>>();

/**
 * The tokens of each line of `code`. The same call returns the same
 * promise, so React `use()` can read it. Null when highlighting fails or the tokens do not spell
 * the source lines exactly; the caller then shows the plain text. Only the colour of a token is
 * taken from the theme, and only when it reads well on paper.
 */
export function highlightLines(code: string, language: string): Promise<HighlightedToken[][] | null> {
	const lang = resolveLanguage(language);
	const key = `${lang}\n${code}`;
	let lines = highlightedLines.get(key);
	if (!lines) {
		lines = loadHighlighter(lang)
			.then((core) => {
				const { tokens } = core.codeToTokens(code, { lang, themes: THEMES });
				const source = code.split("\n");
				const isVerbatim =
					tokens.length === source.length &&
					tokens.every((line, index) => line.map((token) => token.content).join("") === source[index]);
				if (!isVerbatim) return null;
				return tokens.map((line) =>
					line.map((token) => ({
						content: token.content,
						// With a theme pair Shiki puts the light colour in `color` and the dark one in this variable.
						color: readableColor(token.htmlStyle?.color, PAPER_LUMINANCE.light),
						darkColor: readableColor(token.htmlStyle?.["--shiki-dark"], PAPER_LUMINANCE.dark),
					})),
				);
			})
			.catch((error) => {
				console.error("Code highlighting failed", error);
				return null;
			});
		remember(highlightedLines, key, lines);
	}
	return lines;
}
