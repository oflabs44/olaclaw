import type { CSSProperties } from "react";
import type { HighlightedToken } from "./code-highlighter";

/** One source line in its token colours. The text is the tokens' own; the colour is all that is added. */
export function TokenLine({ tokens }: { tokens: readonly HighlightedToken[] }) {
	return tokens.map((token, index) => (
		<span
			key={index}
			// The same switch as Streamdown's code blocks: one variable per theme, ink when there is none.
			className="text-[color:var(--shiki,inherit)] dark:text-[color:var(--shiki-dark,inherit)]"
			style={{ "--shiki": token.color, "--shiki-dark": token.darkColor } as CSSProperties}
		>
			{token.content}
		</span>
	));
}
