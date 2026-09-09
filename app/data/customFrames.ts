/**
 * User-defined custom frames, managed from Settings and stored locally.
 *
 * Custom frames live only in this browser — a localStorage array under
 * "sf:customFrames", kept in sync across components via the
 * "sf:customFramesUpdated" CustomEvent (the same pattern as favorites and
 * recents). They are merged into the launcher by the home route, alongside
 * the built-in sources.
 */

import { sources } from "./sources";
import { showToast } from "../Toast";
import { removeFavoriteUrl, renameFavoriteUrl } from "./favorites";
import { removeRecentByUrl, renameRecentUrl } from "./recent";
import { removeOpenCount, renameOpenCount } from "./openCounts";
import { isEmbeddableUrl } from "../utils/urlGuard";

export type CustomFrame = {
	id: string; // generated at add time
	name: string;
	URL: string;
	description?: string;
	tags: string[]; // may be empty
	kind: "iframe" | "link";
	/** Epoch ms when the frame was added — powers the "Date added" sort. */
	addedAt?: number;
};

export const CUSTOM_FRAMES_KEY = "sf:customFrames";
export const CUSTOM_FRAMES_EVENT = "sf:customFramesUpdated";

/** Normalizes one stored entry; returns null when it is unusable. */
function toCustomFrame(record: Record<string, unknown>): CustomFrame | null {
	if (
		typeof record.id !== "string" ||
		typeof record.name !== "string" ||
		typeof record.URL !== "string"
	) {
		return null;
	}
	if (record.kind !== undefined && record.kind !== "iframe" && record.kind !== "link") return null;
	return {
		id: record.id,
		name: record.name,
		URL: record.URL,
		...(typeof record.description === "string" && record.description
			? { description: record.description }
			: {}),
		tags: Array.isArray(record.tags)
			? record.tags.filter((tag): tag is string => typeof tag === "string")
			: [],
		...(typeof record.addedAt === "number" && Number.isFinite(record.addedAt)
			? { addedAt: record.addedAt }
			: {}),
		kind: record.kind === "link" ? "link" : "iframe",
	};
}

export function readCustomFrames(): CustomFrame[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = localStorage.getItem(CUSTOM_FRAMES_KEY);
		const parsed: unknown = raw ? JSON.parse(raw) : [];
		if (!Array.isArray(parsed)) return [];
		const frames: CustomFrame[] = [];
		for (const entry of parsed) {
			if (!entry || typeof entry !== "object") continue;
			const frame = toCustomFrame(entry as Record<string, unknown>);
			if (frame) frames.push(frame);
		}
		return frames;
	} catch {
		return [];
	}
}

function persist(frames: CustomFrame[]): void {
	try {
		localStorage.setItem(CUSTOM_FRAMES_KEY, JSON.stringify(frames));
	} catch {
		// Never a silent loss: the UI has already shown the new state, so make
		// it clear that this change could not actually be saved.
		showToast(
			"Storage is full or unavailable — custom frames will last for this session only.",
			"error",
		);
	}
	if (typeof window === "undefined") return;
	window.dispatchEvent(new CustomEvent(CUSTOM_FRAMES_EVENT, { detail: { frames } }));
}

function nextFrameId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}
	return `cf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Adds (or replaces, by URL) a custom frame and returns the new list. */
export function addCustomFrame(input: {
	name: string;
	URL: string;
	description?: string;
	tags: string[];
	kind: "iframe" | "link";
}): CustomFrame[] {
	const frames = readCustomFrames();
	const name = input.name.trim();
	const url = input.URL.trim();
	// Same embeddability bar as edit/import (http(s), never this app's own
	// origin) — and a custom frame may not shadow a built-in frame's URL:
	// every list is keyed by URL, so a duplicate would corrupt them.
	if (!name || !isEmbeddableUrl(url) || sources.some((source) => source.URL === url)) {
		return frames;
	}
	const description = input.description?.trim() || undefined;
	const tags = input.tags
		.map((tag) => tag.trim())
		.filter(Boolean)
		.filter((tag, index, all) => all.indexOf(tag) === index);
	const frame: CustomFrame = {
		id: nextFrameId(),
		name,
		URL: url,
		addedAt: Date.now(),
		...(description ? { description } : {}),
		tags,
		kind: input.kind === "link" ? "link" : "iframe",
	};
	const existingIndex = frames.findIndex((entry) => entry.URL === url);
	const next =
		existingIndex === -1
			? [...frames, frame]
			: frames.map((entry, index) => (index === existingIndex ? frame : entry));
	persist(next);
	return next;
}

/**
 * Validates every entry — the same shape checks as readCustomFrames plus
 * the shared embeddability bar and URL/id uniqueness (invalid, non-web, or
 * duplicate entries are skipped, not fatal) — replaces the whole stored
 * list, persists, and
 * broadcasts the update. Used by the Settings data import.
 */
export function writeCustomFrames(frames: CustomFrame[]): CustomFrame[] {
	const validated: CustomFrame[] = [];
	const seenUrls = new Set<string>();
	const seenIds = new Set<string>();
	for (const entry of frames) {
		if (!entry || typeof entry !== "object") continue;
		const frame = toCustomFrame(entry as Record<string, unknown>);
		// Same bar as the interactive paths — shape, embeddability (http(s),
		// never this app's own origin), and no two entries sharing a URL or an
		// id — so import files and undo-restores can never corrupt the
		// URL-keyed lists.
		if (!frame || !isEmbeddableUrl(frame.URL)) continue;
		if (seenUrls.has(frame.URL) || seenIds.has(frame.id)) continue;
		seenUrls.add(frame.URL);
		seenIds.add(frame.id);
		validated.push(frame);
	}
	persist(validated);
	return validated;
}

/**
 * Updates the custom frame with the given id and returns the new list.
 * Unspecified fields keep their current values; a null (or empty)
 * description removes it. The resulting entry is validated and normalized
 * exactly like addCustomFrame (non-empty name, http(s) URL, trimmed
 * values, deduped tags) - on invalid input or an unknown id the list is
 * returned unchanged. The frame keeps its original id and list position.
 */
export function updateCustomFrame(
	id: string,
	changes: {
		name?: string;
		URL?: string;
		description?: string | null;
		tags?: string[];
		kind?: "iframe" | "link";
	},
): CustomFrame[] {
	const frames = readCustomFrames();
	const index = frames.findIndex((entry) => entry.id === id);
	if (index === -1) return frames;
	const current = frames[index];
	const name = (changes.name ?? current.name).trim();
	const url = (changes.URL ?? current.URL).trim();
	// Same embeddability bar as add — and no two frames may share one URL
	// (every list is keyed by URL; a duplicate would corrupt it).
	if (!name || !isEmbeddableUrl(url)) return frames;
	if (frames.some((entry) => entry.id !== id && entry.URL === url)) return frames;
	const rawDescription =
		changes.description === undefined ? current.description : changes.description;
	const description = typeof rawDescription === "string" ? rawDescription.trim() || null : null;
	const tags = (changes.tags ?? current.tags)
		.map((tag) => tag.trim())
		.filter(Boolean)
		.filter((tag, position, all) => all.indexOf(tag) === position);
	const kind = changes.kind === "iframe" || changes.kind === "link" ? changes.kind : current.kind;
	// Reuse the stored-entry normalizer so the persisted shape always
	// matches what readCustomFrames would return.
	const frame = toCustomFrame({
		id: current.id,
		name,
		URL: url,
		...(description ? { description } : {}),
		tags,
		kind,
		// Edits never re-date the frame — "Date added" stays the add time.
		...(current.addedAt === undefined ? {} : { addedAt: current.addedAt }),
	});
	if (!frame) return frames;
	const next = [...frames];
	next[index] = frame;
	persist(next);
	// A URL change must carry the URL-keyed side data (favorites, recents,
	// open counts) over to the new URL — otherwise favorites silently drop,
	// recent chips open the dead URL, and the old count is orphaned.
	if (url !== current.URL) {
		renameFavoriteUrl(current.URL, url);
		renameRecentUrl(current.URL, url, name);
		renameOpenCount(current.URL, url);
	}
	return next;
}

/**
 * Removes the custom frame with the given id and returns the new list. Any
 * recent entries pointing at the deleted frame's URL are pruned too, so the
 * launcher never shows an orphan chip for a frame that no longer exists.
 */
export function deleteCustomFrame(id: string): CustomFrame[] {
	const frames = readCustomFrames();
	const deleted = frames.find((entry) => entry.id === id);
	const next = frames.filter((entry) => entry.id !== id);
	if (next.length === frames.length) return frames;
	persist(next);
	if (deleted) {
		// Prune every URL-keyed trace of the deleted frame, not just recents:
		// a stale favorite badge or an orphaned open count would survive it.
		removeRecentByUrl(deleted.URL);
		removeFavoriteUrl(deleted.URL);
		removeOpenCount(deleted.URL);
	}
	return next;
}
