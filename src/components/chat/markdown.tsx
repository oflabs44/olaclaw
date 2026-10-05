import { Streamdown } from "streamdown";
import { codeHighlighter, THEMES } from "./code-highlighter";

// A bare URL has no break opportunities, so a long one would break mid-word. Allow a break after
// each separator and before each dot instead; the text stays the same for copy and screen readers.
function breakableUrl(text: string) {
	if (!/^\w+:\/\//.test(text)) return text;
	return text.split(/(?<=[/_\-?&=#])|(?=\.)/).flatMap((piece, index) => (index === 0 ? [piece] : [<wbr key={index} />, piece]));
}

// Streamdown completes unterminated markdown while tokens arrive, so a half-open code fence or `**`
// never flickers. The element overrides put the answer on the Bureau tokens instead of Streamdown's
// own classes; the model's text is untrusted, so raw HTML stays off (the default).
const elements = {
	p: ({ children }: { children?: React.ReactNode }) => <p className="my-3 first:mt-0 last:mb-0">{children}</p>,
	h1: ({ children }: { children?: React.ReactNode }) => <h2 className="mt-5 mb-2 text-xl font-semibold first:mt-0">{children}</h2>,
	h2: ({ children }: { children?: React.ReactNode }) => <h2 className="mt-5 mb-2 text-xl font-semibold first:mt-0">{children}</h2>,
	h3: ({ children }: { children?: React.ReactNode }) => <h3 className="mt-4 mb-1.5 text-lg font-semibold first:mt-0">{children}</h3>,
	h4: ({ children }: { children?: React.ReactNode }) => <h4 className="mt-3 mb-1 font-semibold first:mt-0">{children}</h4>,
	ul: ({ children }: { children?: React.ReactNode }) => <ul className="my-3 list-disc pl-6 marker:text-ink-faint">{children}</ul>,
	ol: ({ children }: { children?: React.ReactNode }) => <ol className="my-3 list-decimal pl-6 marker:text-ink-faint">{children}</ol>,
	li: ({ children }: { children?: React.ReactNode }) => <li className="my-1">{children}</li>,
	a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
		<a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
			{typeof children === "string" ? breakableUrl(children) : children}
		</a>
	),
	blockquote: ({ children }: { children?: React.ReactNode }) => (
		<blockquote className="my-3 border-l-2 border-line pl-4 text-ink-soft">{children}</blockquote>
	),
	hr: () => <hr className="my-5 border-line" />,
	table: ({ children }: { children?: React.ReactNode }) => (
		<div className="my-3 overflow-x-auto">
			<table className="w-full border-collapse text-[0.95em]">{children}</table>
		</div>
	),
	th: ({ children }: { children?: React.ReactNode }) => (
		<th className="border-b border-line-strong px-2.5 py-1.5 text-left font-semibold">{children}</th>
	),
	td: ({ children }: { children?: React.ReactNode }) => <td className="border-b border-line px-2.5 py-1.5 align-top">{children}</td>,
};

export function Markdown({ text, isStreaming }: { text: string; isStreaming: boolean }) {
	return (
		<Streamdown
			mode={isStreaming ? "streaming" : "static"}
			isAnimating={isStreaming}
			plugins={{ code: codeHighlighter }}
			shikiTheme={[THEMES.light, THEMES.dark]}
			controls={{ code: { download: false } }}
			components={elements}
			className="text-lg max-wide:text-[17px] max-wide:leading-[1.55] [&_:not(pre)>code]:rounded-[5px] [&_:not(pre)>code]:bg-wash [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[0.9em]"
		>
			{text}
		</Streamdown>
	);
}
