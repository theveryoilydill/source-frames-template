/**
 * Locally stored "recently opened" frames.
 *
 * Mirrors the favorites pattern: a localStorage array kept in sync across
 * components via the "sf:recentUpdated" CustomEvent, so the launcher row and
 * the settings page stay current without prop drilling.
 */

export type RecentEntry = {
	URL: string;
	name: string;
	/** When the frame was last opened (epoch ms); absent in older stored entries. */
	openedAt?: number;
};

export const RECENT_KEY = "sf:recent";
export const RECENT_EVENT = "sf:recentUpdated";
export const RECENT_LIMIT = 6;

export function readRecent(): RecentEntry[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = localStorage.getItem(RECENT_KEY);
		const parsed = raw ? (JSON.parse(raw) as RecentEntry[]) : [];
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((entry) => {
			if (!entry || typeof entry.URL !== "string" || typeof entry.name !== "string") return false;
			if (entry.openedAt === undefined) return true;
			return typeof entry.openedAt === "number" && Number.isFinite(entry.openedAt);
		});
	} catch {
		return [];
	}
}

/**
 * Validates entries (non-empty string url/name, finite openedAt), dedupes by URL
 * (first occurrence wins), caps the list, persists it, and broadcasts the
 * update so every listener re-reads.
 */
export function writeRecent(entries: RecentEntry[]): RecentEntry[] {
	const seen = new Set<string>();
	const sanitized: RecentEntry[] = [];
	for (const entry of entries) {
		if (
			!entry ||
			typeof entry.URL !== "string" ||
			!entry.URL ||
			typeof entry.name !== "string" ||
			!entry.name
		)
			continue;
		if (
			entry.openedAt !== undefined &&
			(typeof entry.openedAt !== "number" || !Number.isFinite(entry.openedAt))
		) {
			continue;
		}
		if (seen.has(entry.URL)) continue;
		seen.add(entry.URL);
		sanitized.push(
			entry.openedAt === undefined
				? { URL: entry.URL, name: entry.name }
				: { URL: entry.URL, name: entry.name, openedAt: entry.openedAt },
		);
	}
	const capped = sanitized.slice(0, RECENT_LIMIT);
	try {
		localStorage.setItem(RECENT_KEY, JSON.stringify(capped));
	} catch {
		/* storage unavailable — recents stay session-only */
	}
	if (typeof window === "undefined") return capped;
	window.dispatchEvent(new CustomEvent(RECENT_EVENT, { detail: { recent: capped } }));
	return capped;
}

/** Moves url/name to the front of the recents list (deduped by URL, capped, timestamped). */
export function pushRecent(url: string, name: string): RecentEntry[] {
	return writeRecent([
		{ URL: url, name, openedAt: Date.now() },
		...readRecent().filter((entry) => entry.URL !== url),
	]);
}

export function clearRecent(): RecentEntry[] {
	return writeRecent([]);
}

/** Removes every recent entry with the given URL; no-op (no write/event) when none match. */
export function removeRecentByUrl(url: string): RecentEntry[] {
	const recent = readRecent();
	const next = recent.filter((entry) => entry.URL !== url);
	if (next.length === recent.length) return recent;
	return writeRecent(next);
}

/**
 * Human-readable age of a timestamp — long form for titles ("4 minutes ago"),
 * short form for chips ("4m"); falls back to a short date beyond a week.
 */
export function formatRelativeTime(ts: number, long = false): string {
	const diff = Date.now() - ts;
	if (diff < 45_000) return long ? "just now" : "now";

	const minutes = Math.floor(diff / 60_000);
	if (minutes < 60) {
		if (long) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
		return `${minutes}m`;
	}

	const hours = Math.floor(diff / 3_600_000);
	if (hours < 24) {
		if (long) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
		return `${hours}h`;
	}

	const days = Math.floor(diff / 86_400_000);
	if (days < 7) {
		if (long) return days === 1 ? "1 day ago" : `${days} days ago`;
		return `${days}d`;
	}

	if (long) return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
	return `${days}d`;
}
