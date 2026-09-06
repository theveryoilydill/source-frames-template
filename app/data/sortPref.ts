/**
 * Persisted launcher sort preference.
 *
 * The smallest sibling of the sf:* data modules: a single localStorage key
 * read and written only by the launcher route (home.tsx), so unlike
 * favorites/recents there is no CustomEvent — nothing else needs to react
 * to a change. Invalid or missing values always fall back to "default".
 */

/** "default" = built-ins then custom frames; "alpha" = name A–Z; "opened" = most-opened first. */
export type SortPref = "default" | "alpha" | "opened";

export const SORT_KEY = "sf:sort";

const SORT_PREFS: readonly SortPref[] = ["default", "alpha", "opened"];

/**
 * Reads the stored sort preference — only the exact known values are
 * accepted; anything else (junk, legacy, corrupted storage) reads as
 * "default". SSR-safe: returns "default" outside the browser.
 */
export function readSortPref(): SortPref {
	if (typeof window === "undefined") return "default";
	try {
		const raw = localStorage.getItem(SORT_KEY);
		return raw === "alpha" || raw === "opened" ? raw : "default";
	} catch {
		return "default";
	}
}

/**
 * Validates and persists pref, returning the value actually in effect.
 * Invalid values are rejected without touching storage; storage failures
 * are non-fatal — the preference then simply stays session-only.
 */
export function writeSortPref(pref: SortPref): SortPref {
	if (!SORT_PREFS.includes(pref)) return "default";
	try {
		localStorage.setItem(SORT_KEY, pref);
	} catch {
		/* storage unavailable — the preference stays session-only */
	}
	return pref;
}
