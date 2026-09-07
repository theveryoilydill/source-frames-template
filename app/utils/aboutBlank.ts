/**
 * Pop-out tabs as about:blank "cloaked" tabs.
 *
 * Why: "open in new tab" should open a blank tab that we populate ourselves,
 * not a tab that navigates straight to the source URL. window.open() MUST be
 * called synchronously inside the user-gesture handler or popup blockers will
 * swallow it; the resulting about:blank window inherits the opener's origin,
 * which lets us document.write() a minimal shell (dark page, full-viewport
 * iframe) that then loads the real source.
 */

const escapeHtml = (value: string) =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");

const hostnameOf = (url: string) => {
	try {
		return new URL(url).hostname || url;
	} catch {
		return url;
	}
};

/**
 * Open a new tab as about:blank and inject `url` into it inside a
 * full-viewport iframe. Must be called directly from a user-gesture handler
 * (click/keydown), never from async code. Returns true when the tab was
 * opened and populated; false when the URL is not http(s) or the popup was
 * blocked (callers can then fall back to a plain window.open).
 */
export function openAboutBlank(url: string, title?: string): boolean {
	// Only real web origins make sense behind the injected shell.
	if (!/^https?:\/\//i.test(url)) return false;

	const safeUrl = escapeHtml(url);
	const safeTitle = escapeHtml(title || hostnameOf(url));

	try {
		// Synchronous on purpose: running inside the click gesture is what
		// keeps popup blockers from killing the tab.
		const win = window.open("about:blank", "_blank");
		if (!win) return false;

		win.document.write(
			`<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>html,body{margin:0;padding:0;height:100%;background:#0b0e14}iframe{display:block;border:0;width:100%;height:100dvh}</style></head><body><iframe src="${safeUrl}" allow="fullscreen" allowfullscreen></iframe></body></html>`,
		);
		win.document.close();
		return true;
	} catch {
		return false;
	}
}
