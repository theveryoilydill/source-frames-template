/**
 * Persisted launcher sort preference.
 *
 * The smallest sibling of the sf:* data modules: a single localStorage key
 * read and written only by the launcher route (home.tsx), so unlike
 * favorites/recents there is no CustomEvent — nothing else needs to react
 * to a change. Invalid, missing, or legacy values always fall back to
 * "alpha" — since the built-in default order was removed, A–Z IS the
 * launcher default.
 */

/** "alpha" = name A–Z (default); "zeta" = Z–A; "added" = newest added first; "opened" = most-opened first. */
export type SortPref = "alpha" | "zeta" | "added" | "opened";

export const SORT_KEY = "sf:sort";

const SORT_PREFS: readonly SortPref[] = ["alpha", "zeta", "added", "opened"];

/**
 * Reads the stored sort preference — only the exact known values are
 * accepted; anything else (junk, the retired "default" value, corrupted
 * storage) reads as "alpha". SSR-safe: returns "alpha" outside the browser.
 */
export function readSortPref(): SortPref {
	if (typeof window === "undefined") return "alpha";
	try {
		const raw = localStorage.getItem(SORT_KEY);
		return raw === "zeta" || raw === "added" || raw === "opened" ? raw : "alpha";
	} catch {
		return "alpha";
	}
}

/**
 * Validates and persists pref, returning the value actually in effect.
 * Invalid values are rejected without touching storage; storage failures
 * are non-fatal — the preference then simply stays session-only.
 */
export function writeSortPref(pref: SortPref): SortPref {
	if (!SORT_PREFS.includes(pref)) return "alpha";
	try {
		localStorage.setItem(SORT_KEY, pref);
	} catch {
		/* storage unavailable — the preference stays session-only */
	}
	return pref;
}
