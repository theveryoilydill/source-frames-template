/**
 * Per-frame open counts.
 *
 * Mirrors the favorites/recents pattern: a localStorage map keyed by frame
 * URL, kept in sync across components via the "sf:openCountsUpdated"
 * CustomEvent, so cards and the recents row can show how often a frame was
 * opened without prop drilling through the FramesList boundary.
 */

export const OPEN_COUNTS_KEY = "sf:openCounts";
export const OPEN_COUNTS_EVENT = "sf:openCountsUpdated";

/**
 * Reads the open-count map — non-empty string keys carrying finite positive
 * integer values only; {} on error or outside the browser (SSR).
 */
export function readOpenCounts(): Record<string, number> {
	if (typeof window === "undefined") return {};
	try {
		const raw = localStorage.getItem(OPEN_COUNTS_KEY);
		const parsed: unknown = raw ? JSON.parse(raw) : {};
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
		const counts: Record<string, number> = {};
		for (const [key, value] of Object.entries(parsed)) {
			if (key.length === 0) continue;
			if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) continue;
			counts[key] = value;
		}
		return counts;
	} catch {
		return {};
	}
}

/** Increments url's count (starting at 1), persists, and broadcasts the update. */
export function recordOpen(url: string): Record<string, number> {
	const counts = readOpenCounts();
	counts[url] = (counts[url] ?? 0) + 1;
	try {
		localStorage.setItem(OPEN_COUNTS_KEY, JSON.stringify(counts));
	} catch {
		/* storage unavailable — counts stay session-only */
	}
	window.dispatchEvent(new CustomEvent(OPEN_COUNTS_EVENT, { detail: { counts } }));
	return counts;
}

/** Clears every open count, persists the empty map, and broadcasts the update. */
export function clearOpenCounts(): Record<string, number> {
	const counts: Record<string, number> = {};
	try {
		localStorage.setItem(OPEN_COUNTS_KEY, JSON.stringify(counts));
	} catch {
		/* storage unavailable — counts stay session-only */
	}
	window.dispatchEvent(new CustomEvent(OPEN_COUNTS_EVENT, { detail: { counts } }));
	return counts;
}
