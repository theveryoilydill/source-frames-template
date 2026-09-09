/**
 * Pop-out tabs as about:blank "cloaked" tabs.
 *
 * Why: "open in new tab" should open a blank tab that we populate ourselves,
 * not a tab that navigates straight to the source URL. window.open() MUST be
 * called synchronously inside the user-gesture handler or popup blockers will
 * swallow it; the resulting about:blank window inherits the opener's origin,
 * which lets us build a minimal shell (dark page, full-viewport iframe) that
 * then loads the real source.
 */

import { isEmbeddableUrl } from "./urlGuard";

const hostnameOf = (url: string) => {
	try {
		return new URL(url).hostname || url;
	} catch {
		return url;
	}
};

/** Shell CSS for the cloaked pop-out tab (static text, never user input). */
const SHELL_STYLE =
	"html,body{margin:0;padding:0;height:100%;background:#0b0e14}iframe{display:block;border:0;width:100%;height:100dvh}";

/**
 * Open a new tab as about:blank and build `url` into it as a full-viewport
 * iframe. Must be called directly from a user-gesture handler (click/keydown),
 * never from async code. Returns true when the tab was opened and populated;
 * false when the URL is not embeddable (non-http(s) or this app's own origin —
 * see urlGuard) or the popup was blocked (callers can fall back to a plain
 * window.open).
 *
 * The shell is assembled with DOM APIs on purpose: no document.write() and no
 * HTML string interpolation means user-controlled URLs and titles can never
 * turn into markup (CodeQL's Client-side cross-site scripting flags exactly
 * that pattern, and a hand-rolled escapeHtml is not a sanitizer it can model).
 * Every value lands in the DOM slot meant for it — the title as document
 * title, the URL as the iframe's src property — with nothing in between.
 */
export function openAboutBlank(url: string, title?: string): boolean {
	// Only real web origins make sense behind the injected shell — and the
	// shell is same-origin with the app, so the shared same-origin guard
	// applies here too.
	if (!isEmbeddableUrl(url)) return false;

	try {
		// Synchronous on purpose: running inside the click gesture is what
		// keeps popup blockers from killing the tab.
		const win = window.open("about:blank", "_blank");
		if (!win) return false;

		const doc = win.document;
		doc.title = title || hostnameOf(url);
		const style = doc.createElement("style");
		style.textContent = SHELL_STYLE;
		doc.head.appendChild(style);
		const frame = doc.createElement("iframe");
		frame.src = url;
		frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups");
		frame.setAttribute("allow", "fullscreen");
		frame.setAttribute("allowfullscreen", "");
		doc.body.appendChild(frame);

		// Sever the opener: the tab is same-origin with this app, and an
		// embedded page could otherwise navigate `opener` (i.e. the app tab)
		// to a phishing clone after any user interaction inside the frame.
		try {
			win.opener = null;
		} catch {
			/* already cross-origin / unsupported — nothing to sever */
		}
		return true;
	} catch {
		return false;
	}
}

/**
 * Plain new-tab handoff with the same embeddability bar as the cloaked
 * shell: http(s) only and never this app's own origin. Returns true when
 * the tab was opened, false when the URL was rejected.
 */
export function openDirectTab(url: string): boolean {
	if (!isEmbeddableUrl(url)) return false;
	window.open(url, "_blank", "noopener,noreferrer");
	return true;
}

/**
 * The single owner of the "pop this frame out" sequence, shared by the
 * viewer navbar and every other pop-out entry point: try the cloaked shell
 * first, fall back to a guarded plain tab when the popup was blocked, and
 * reject non-embeddable URLs outright (callers can toast on the false).
 */
export function popOutFrame(url: string, title?: string): boolean {
	if (!isEmbeddableUrl(url)) return false;
	if (openAboutBlank(url, title)) return true;
	return openDirectTab(url);
}
