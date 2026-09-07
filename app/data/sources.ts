/**
 * The launcher's data model.
 *
 * kind: "iframe" — the source is opened in a sandboxed overlay inside the app.
 * kind: "link"   — the source is opened in a new browser tab.
 *
 * NOTE: many sites send `X-Frame-Options` / CSP `frame-ancestors` and refuse
 * to be embedded in an iframe. Use kind: "link" for those, otherwise the
 * overlay will render an empty/blocked frame for that source.
 *
 * NOTE: the overlay iframe is sandboxed with allow-scripts + allow-same-origin
 * (some embeds need their own storage). Keep every kind: "iframe" URL on a
 * third-party origin — never point one at this site's own origin, or that
 * page could escape its sandbox and reach the app's localStorage.
 */
export type SourceData = {
	name: string;
	URL: string;
	description?: string;
	/** Legacy single-category field, kept only for backward compatibility. */
	category?: string;
	/** Modular multi-tag labels used for filtering and card chips. */
	tags?: string[];
	kind?: "iframe" | "link";
};

/**
 * A source's tags: the modular `tags` list when present, otherwise the legacy
 * `category` as a one-tag list, otherwise a generic "General" tag.
 */
export function getSourceTags(source: SourceData): string[] {
	return source.tags ?? (source.category ? [source.category] : ["General"]);
}

export const sources: SourceData[] = [
	{
		name: "Wikipedia: Mission control center",
		URL: "https://en.wikipedia.org/wiki/Mission_control_center",
		description: "How mission control rooms run launches and flights, from the encyclopedia.",
		tags: ["Reference", "Space", "Reading"],
		kind: "iframe",
	},
	{
		name: "Terminal Weather",
		URL: "https://wttr.in/London",
		description:
			"Live weather readout for London from the wttr.in service, rendered like a terminal panel.",
		tags: ["Weather", "Terminal", "Live data"],
		kind: "iframe",
	},
	{
		name: "Excalidraw",
		URL: "https://excalidraw.com",
		description:
			"Virtual whiteboard for sketching hand-drawn diagrams, flows, and architecture notes.",
		tags: ["Whiteboard", "Design", "Drawing"],
		kind: "iframe",
	},
	{
		name: "Example.com",
		URL: "https://example.com",
		description: "The canonical placeholder domain, handy for checking how link kinds behave.",
		tags: ["General", "Testing"],
		kind: "iframe",
	},
	{
		name: "MDN Web Docs",
		URL: "https://developer.mozilla.org",
		description: "Mozilla's reference for HTML, CSS, and JavaScript, the web platform manual.",
		tags: ["Reference", "Development", "Docs"],
		kind: "iframe",
	},
];
