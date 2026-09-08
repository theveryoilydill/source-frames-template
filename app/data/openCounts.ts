/**
 * Per-frame open counts.
 *
 * Mirrors the favorites/recents pattern: a localStorage map keyed by frame
 * URL, kept in sync across components via the "sf:openCountsUpdated"
 * CustomEvent, so cards and the recents row can show how often a frame was
 * opened without prop drilling through the FramesList boundary.
 */

import { showToast } from "../Toast";

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

/** Persists counts and broadcasts the update (the single write funnel). */
function persistCounts(counts: Record<string, number>): Record<string, number> {
	try {
		localStorage.setItem(OPEN_COUNTS_KEY, JSON.stringify(counts));
	} catch {
		showToast(
			"Storage is full or unavailable — open counts will last for this session only.",
			"error",
		);
	}
	if (typeof window === "undefined") return counts;
	window.dispatchEvent(new CustomEvent(OPEN_COUNTS_EVENT, { detail: { counts } }));
	return counts;
}

/** Increments url's count (starting at 1), persists, and broadcasts the update. */
export function recordOpen(url: string): Record<string, number> {
	const counts = readOpenCounts();
	counts[url] = (counts[url] ?? 0) + 1;
	return persistCounts(counts);
}

/** Clears every open count, persists the empty map, and broadcasts the update. */
export function clearOpenCounts(): Record<string, number> {
	return persistCounts({});
}

/** Removes url's count; no-op (no write/event) when absent. */
export function removeOpenCount(url: string): Record<string, number> {
	const counts = readOpenCounts();
	if (!(url in counts)) return counts;
	delete counts[url];
	return persistCounts(counts);
}

/**
 * Carries oldUrl's count over to newUrl after a custom frame's URL edit,
 * keeping whichever count is higher; no-op when oldUrl was never opened.
 */
export function renameOpenCount(oldUrl: string, newUrl: string): Record<string, number> {
	const counts = readOpenCounts();
	if (!(oldUrl in counts)) return counts;
	const value = counts[oldUrl];
	delete counts[oldUrl];
	counts[newUrl] = Math.max(counts[newUrl] ?? 0, value);
	return persistCounts(counts);
}
