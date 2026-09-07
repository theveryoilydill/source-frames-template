/**
 * Ordered favorites.
 *
 * The stored array doubles as the display order: when the favorites filter is
 * active, favorited frames are shown in this order and drag (or Alt+Arrow)
 * reordering persists the new arrangement back to localStorage.
 *
 * Same storage key and sync CustomEvent as the rest of the app, so existing
 * stored favorites keep working unchanged — and when the new key reads as
 * empty, a one-time migration offers the removed SettingsProvider's favorites
 * (saved under localStorage["settings"] as frame NAMES) a way back.
 */

import { readCustomFrames } from "./customFrames";
import { sources } from "./sources";

export const FAVORITES_KEY = "sf:favorites";
export const FAVORITES_EVENT = "sf:favoritesUpdated";

/** Pre-sf:* storage: the removed SettingsProvider persisted favorites here. */
const LEGACY_SETTINGS_KEY = "settings";

/** At most one migration attempt per session — a re-run could never find more. */
let legacyMigrationAttempted = false;

/**
 * One-time upgrade from the legacy SettingsProvider. Favorites were saved as
 * frame NAMES (localStorage["settings"].FavoriteNames — with an even older
 * FavoriteIndexes variant), so map names onto current frame URLs — built-ins
 * first, then custom frames, case-insensitively — and keep only the ones that
 * still resolve. On success (or a confirmed-empty record) the legacy key is
 * removed: leaving it in place would let "Reset all data" (which clears only
 * the sf:* keys) resurrect stale favorites on the next load. Every storage
 * access is guarded — a blocked or missing localStorage simply yields no
 * migration, exactly like the reads above.
 */
function migrateLegacyFavorites(): string[] {
	try {
		const raw = localStorage.getItem(LEGACY_SETTINGS_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object") return [];
		const record = parsed as Record<string, unknown>;

		// Name-based entries are the shape the legacy UI actually read.
		let legacyEntries: string[] = Array.isArray(record.FavoriteNames)
			? record.FavoriteNames.filter((entry): entry is string => typeof entry === "string")
			: [];
		if (legacyEntries.length === 0 && Array.isArray(record.FavoriteIndexes)) {
			// Oldest shape: indexes into the built-in sources list. Best-effort
			// only — the list may have changed since they were saved.
			legacyEntries = record.FavoriteIndexes.filter(
				(entry): entry is number =>
					typeof entry === "number" &&
					Number.isInteger(entry) &&
					entry >= 0 &&
					entry < sources.length,
			).map((index) => sources[index].name);
		}
		if (legacyEntries.length === 0) {
			// Nothing usable here — drop the dead key so it is never consulted
			// again, then report empty.
			localStorage.removeItem(LEGACY_SETTINGS_KEY);
			return [];
		}

		const urlByName = new Map<string, string>();
		for (const source of sources) urlByName.set(source.name.toLowerCase(), source.URL);
		for (const frame of readCustomFrames()) {
			if (!urlByName.has(frame.name.toLowerCase()))
				urlByName.set(frame.name.toLowerCase(), frame.URL);
		}

		const seen = new Set<string>();
		const favorites: string[] = [];
		for (const entry of legacyEntries) {
			const url = urlByName.get(entry.trim().toLowerCase());
			if (!url || seen.has(url)) continue;
			seen.add(url);
			favorites.push(url);
		}

		localStorage.removeItem(LEGACY_SETTINGS_KEY);
		return favorites.length > 0 ? writeFavorites(favorites) : [];
	} catch {
		return [];
	}
}

/** Reads the ordered favorites list — string entries only, deduped (first wins). */
export function readFavorites(): string[] {
	if (typeof window === "undefined") return [];
	let favorites: string[] = [];
	// Absence — not emptiness — is what signals "this storage was never
	// used": an explicit clear writes "[]" so a deliberately cleared list is
	// never re-seeded from the legacy key below.
	let keyAbsent = true;
	try {
		const raw = localStorage.getItem(FAVORITES_KEY);
		keyAbsent = raw === null;
		const parsed: unknown = raw ? JSON.parse(raw) : [];
		if (Array.isArray(parsed)) {
			const seen = new Set<string>();
			for (const item of parsed) {
				if (typeof item !== "string" || seen.has(item)) continue;
				seen.add(item);
				favorites.push(item);
			}
		}
	} catch {
		// Storage unavailable or corrupt — fall back to empty below (the same
		// guard the rest of the reads in this module use).
		favorites = [];
	}
	// Absent new-key read: before treating that as "no favorites", give the
	// legacy SettingsProvider data its one chance to come across.
	if (favorites.length === 0 && keyAbsent && !legacyMigrationAttempted) {
		legacyMigrationAttempted = true;
		favorites = migrateLegacyFavorites();
	}
	return favorites;
}

/** Dedupes (first occurrence wins), persists, and broadcasts the update. */
export function writeFavorites(urls: string[]): string[] {
	const seen = new Set<string>();
	const favorites = urls.filter((url) => {
		if (seen.has(url)) return false;
		seen.add(url);
		return true;
	});
	try {
		localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
	} catch {
		/* storage unavailable — favorites stay session-only */
	}
	window.dispatchEvent(new CustomEvent(FAVORITES_EVENT, { detail: { favorites } }));
	return favorites;
}

/** Removes url from the order if present, else appends it to the end. */
export function toggleFavoriteUrl(url: string): string[] {
	const favorites = readFavorites();
	const next = favorites.filter((favorite) => favorite !== url);
	if (next.length === favorites.length) next.push(url);
	return writeFavorites(next);
}

/** Moves the favorite at index `from` to index `to`; out-of-bounds moves are a no-op. */
export function reorderFavorite(from: number, to: number): string[] {
	const favorites = readFavorites();
	if (!Number.isInteger(from) || !Number.isInteger(to)) return favorites;
	if (from < 0 || from >= favorites.length || to < 0 || to >= favorites.length) return favorites;
	const [moved] = favorites.splice(from, 1);
	favorites.splice(to, 0, moved);
	return writeFavorites(favorites);
}
