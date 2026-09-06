/**
 * Ordered favorites.
 *
 * The stored array doubles as the display order: when the favorites filter is
 * active, favorited frames are shown in this order and drag (or Alt+Arrow)
 * reordering persists the new arrangement back to localStorage.
 *
 * Same storage key and sync CustomEvent as the rest of the app, so existing
 * stored favorites keep working unchanged.
 */

export const FAVORITES_KEY = "sf:favorites";
export const FAVORITES_EVENT = "sf:favoritesUpdated";

/** Reads the ordered favorites list — string entries only, deduped (first wins). */
export function readFavorites(): string[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = localStorage.getItem(FAVORITES_KEY);
		const parsed: unknown = raw ? JSON.parse(raw) : [];
		if (!Array.isArray(parsed)) return [];
		const seen = new Set<string>();
		const favorites: string[] = [];
		for (const item of parsed) {
			if (typeof item !== "string" || seen.has(item)) continue;
			seen.add(item);
			favorites.push(item);
		}
		return favorites;
	} catch {
		return [];
	}
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
