/**
 * Shared URL validation for every path that can put a frame on screen:
 * add, edit, import, drag/paste, and the pop-out shell.
 *
 * Two bars are enforced app-wide:
 *
 * - http(s) only. The viewer renders arbitrary URLs inside a sandboxed
 *   iframe and the pop-out injects them into an attribute; `javascript:`,
 *   `data:`, and other non-web schemes have no legitimate frame use here
 *   and `data:` in particular would run attacker HTML inside the trusted
 *   viewer chrome (React's own sanitizer only blocks `javascript:`).
 * - never this app's own origin. The viewer iframe is sandboxed with
 *   allow-scripts + allow-same-origin (see FrameContent), a combination
 *   whose own spec warning is "consider dropping allow-same-origin if the
 *   content is not trusted" — a same-origin frame could simply drop its
 *   sandbox and reach the app's DOM and localStorage.
 */

const WEB_URL_PATTERN = /^https?:\/\//i;

/** Whether url is an http(s) URL (scheme check only; SSR-safe). */
export function isWebUrl(url: string): boolean {
	return WEB_URL_PATTERN.test(url.trim());
}

/**
 * Whether url may be embedded in the iframe viewer or the pop-out shell:
 * isWebUrl plus the same-origin guard. Outside a browser (SSR) only the
 * scheme check applies.
 */
export function isEmbeddableUrl(url: string): boolean {
	if (!isWebUrl(url)) return false;
	if (typeof window === "undefined" || typeof location === "undefined") return true;
	try {
		return new URL(url.trim()).host !== location.host;
	} catch {
		return false;
	}
}
