import type { Route } from "./+types/home";
import { useEffect, useMemo, useRef, useState } from "react";
import Header from "../Header";
import Footer from "../Footer";
import FramesList from "../FramesList/FramesList";
import FrameContent from "../FrameContent/FrameContent";
import TagsMenu from "../TagsMenu";
import ShortcutsDialog from "../ShortcutsDialog";
import CommandPalette from "../CommandPalette";
import { showToast } from "../Toast";
import { getSourceTags, sources } from "../data/sources";
import type { SourceData } from "../data/sources";
import {
	FAVORITES_EVENT,
	readFavorites,
	reorderFavorite,
	toggleFavoriteUrl,
} from "../data/favorites";
import {
	RECENT_EVENT,
	clearRecent,
	pushRecent,
	readRecent,
	type RecentEntry,
} from "../data/recent";
import {
	CUSTOM_FRAMES_EVENT,
	addCustomFrame,
	readCustomFrames,
	type CustomFrame,
} from "../data/customFrames";
import { OPEN_COUNTS_EVENT, readOpenCounts, recordOpen } from "../data/openCounts";
import { isEmbeddableUrl } from "../utils/urlGuard";
import { readSortPref, writeSortPref, type SortPref } from "../data/sortPref";

export function meta(_args: Route.MetaArgs) {
	const title = "Source Frames — open your sources in place";
	const description =
		"Open tools, references, and live readouts in framed overlays without leaving the page, with search, tags, favorites, and your own custom frames.";
	return [
		{ title },
		{ name: "description", content: description },
		{ property: "og:title", content: title },
		{ property: "og:description", content: description },
		{ property: "og:type", content: "website" },
		{ name: "twitter:card", content: "summary" },
	];
}

function SearchIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			className="h-5 w-5"
			aria-hidden
		>
			<circle cx="11" cy="11" r="7" />
			<path d="m21 21-4.3-4.3" />
		</svg>
	);
}

function XIcon({ className = "h-3 w-3" }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden
		>
			<path d="M18 6 6 18M6 6l12 12" />
		</svg>
	);
}

/** Lucide-style download arrow for the drop-a-URL overlay. */
function DownloadIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			className="h-6 w-6"
			aria-hidden
		>
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<path d="m7 10 5 5 5-5" />
			<path d="M12 15V3" />
		</svg>
	);
}

function HeartIcon({ filled }: { filled: boolean }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill={filled ? "currentColor" : "none"}
			stroke="currentColor"
			strokeWidth={1.8}
			strokeLinecap="round"
			strokeLinejoin="round"
			className="h-4 w-4"
			aria-hidden
		>
			<path d="M12 20.5c-.3 0-.6-.1-.8-.3C6.4 16.4 3 13.4 3 9.9 3 7.2 5.1 5 7.8 5c1.6 0 3.1.8 4.2 2.1C13.1 5.8 14.6 5 16.2 5 18.9 5 21 7.2 21 9.9c0 3.5-3.4 6.5-8.2 10.3-.2.2-.5.3-.8.3Z" />
		</svg>
	);
}

/** Lucide-style chevron for the sort select (the wrapper draws the pill). */
function ChevronDownIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			className="h-3.5 w-3.5"
			aria-hidden
		>
			<path d="m6 9 6 6 6-6" />
		</svg>
	);
}

/** Hostname with a leading "www." stripped — the display name for dropped
 *  and pasted URLs (generic fallback when the string does not parse). */
function frameNameFromUrl(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "") || "frame";
	} catch {
		return "frame";
	}
}

/**
 * The one add-a-URL flow, shared by drag-drop and paste so both paths behave
 * identically: add-vs-update detection, the storage write (the launcher
 * re-renders via the CUSTOM_FRAMES_EVENT listener), and the result toast.
 */
function addFrameFromUrl(url: string) {
	// Built-ins can't be shadowed by a custom frame (every list is keyed by
	// URL), and the shared guard keeps non-web / self-origin URLs out of the
	// viewer.
	if (sources.some((source) => source.URL === url)) {
		showToast(`${frameNameFromUrl(url)} is already one of the built-in frames`, "info");
		return;
	}
	if (!isEmbeddableUrl(url)) {
		showToast("That URL can't be added as a frame (http(s) URLs only).", "error");
		return;
	}
	const existed = readCustomFrames().some((frame) => frame.URL === url);
	const name = frameNameFromUrl(url);
	addCustomFrame({ name, URL: url, tags: [], kind: "iframe" });
	if (existed) {
		showToast(`Updated ${name} (already existed)`, "info");
	} else {
		showToast(`Added ${name} to your frames`, "success");
	}
}

export default function Home() {
	const [query, setQuery] = useState("");
	const [favoritesOnly, setFavoritesOnly] = useState(false);
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	// The favorites array IS the display order — drag reorder in the
	// favorites view rewrites it (see app/data/favorites.ts).
	const [favorites, setFavorites] = useState<string[]>([]);
	const [recent, setRecent] = useState<RecentEntry[]>([]);
	const [customFrames, setCustomFrames] = useState<CustomFrame[]>([]);
	// Launcher sort for the normal (non-favorites) view; persisted via
	// app/data/sortPref.ts and restored on mount below. A–Z is the default:
	// the built-in "default" order was retired in favor of always sorting
	// alphabetically unless another order is picked.
	const [sort, setSort] = useState<SortPref>("alpha");
	// Open counts power the "Most opened" sort — read + event-synced like
	// the other data modules; frames never opened count as 0.
	const [openCounts, setOpenCounts] = useState<Record<string, number>>({});
	const [showShortcuts, setShowShortcuts] = useState(false);
	// Ctrl+K command palette (keep-mounted; the component gates its own DOM).
	const [showPalette, setShowPalette] = useState(false);
	// Frame opened from the palette. The cards' viewer state lives inside
	// FramesList, so the palette gets its own instance of the same shared
	// FrameContent overlay here.
	const [paletteFrame, setPaletteFrame] = useState<{ url: string; title?: string } | null>(null);
	// Focus restore for the palette-opened viewer. The viewer's focus trap
	// restores to whatever it captured at mount, and for a palette-opened
	// viewer that element is unreliable (the palette input it focused is
	// unmounted with the palette, or body) — so the pre-Ctrl+K
	// activeElement is captured HERE, before the palette opens, and the
	// viewer's onClose restores it. Cleared when the palette closes
	// without opening a viewer so a stale element is never restored later.
	const paletteReturnFocusRef = useRef<HTMLElement | null>(null);
	// Marks that a palette row opened the shared viewer, letting the
	// palette's onClose distinguish "closed empty" from "closed into a
	// viewer" — only the latter may keep the restore target alive.
	const paletteOpenedViewerRef = useRef(false);
	// True while an external URL drag hovers the window (drop-a-URL overlay).
	const [dragActive, setDragActive] = useState(false);
	// Ref mirrors for the mount-once drag listeners (state would be stale there).
	const dragActiveRef = useRef(false);
	const dragDepthRef = useRef(0);
	const searchRef = useRef<HTMLInputElement>(null);

	// Load favorites once and stay in sync across components via the
	// "sf:favoritesUpdated" CustomEvent.
	useEffect(() => {
		if (typeof window === "undefined") return;
		setFavorites(readFavorites());
		const handler = () => setFavorites(readFavorites());
		window.addEventListener(FAVORITES_EVENT, handler as EventListener);
		return () => window.removeEventListener(FAVORITES_EVENT, handler as EventListener);
	}, []);

	// Load recents once and stay in sync via the "sf:recentUpdated"
	// CustomEvent (same pattern as favorites).
	useEffect(() => {
		if (typeof window === "undefined") return;
		setRecent(readRecent());
		const onRecent = () => setRecent(readRecent());
		window.addEventListener(RECENT_EVENT, onRecent as EventListener);
		return () => window.removeEventListener(RECENT_EVENT, onRecent as EventListener);
	}, []);

	// Custom frames from Settings join the launcher the same way.
	useEffect(() => {
		if (typeof window === "undefined") return;
		setCustomFrames(readCustomFrames());
		const onCustom = () => setCustomFrames(readCustomFrames());
		window.addEventListener(CUSTOM_FRAMES_EVENT, onCustom as EventListener);
		return () => window.removeEventListener(CUSTOM_FRAMES_EVENT, onCustom as EventListener);
	}, []);

	// Restore the persisted sort preference once on mount. SSR always
	// renders the "default" order, so the first client render matches the
	// server HTML and the restore happens after hydration.
	useEffect(() => {
		if (typeof window === "undefined") return;
		setSort(readSortPref());
	}, []);

	// Open counts feed the "Most opened" sort — read once on mount, then
	// re-read on the shared "sf:openCountsUpdated" event (the same pattern
	// as the favorites/recents syncs above).
	useEffect(() => {
		if (typeof window === "undefined") return;
		setOpenCounts(readOpenCounts());
		const onOpenCounts = () => setOpenCounts(readOpenCounts());
		window.addEventListener(OPEN_COUNTS_EVENT, onOpenCounts as EventListener);
		return () => window.removeEventListener(OPEN_COUNTS_EVENT, onOpenCounts as EventListener);
	}, []);

	// Cross-tab sync: storage events fire only in OTHER tabs, complementing
	// the same-document CustomEvent listeners above — a second tab never
	// shows stale favorites/recents/frames/counts.
	useEffect(() => {
		if (typeof window === "undefined") return;
		const onStorage = (event: StorageEvent) => {
			if (event.key !== null && !event.key.startsWith("sf:")) return;
			setFavorites(readFavorites());
			setRecent(readRecent());
			setCustomFrames(readCustomFrames());
			setOpenCounts(readOpenCounts());
		};
		window.addEventListener("storage", onStorage);
		return () => window.removeEventListener("storage", onStorage);
	}, []);

	// Drag a URL from outside the app onto the page to add a custom frame.
	// Window-level listeners; internal favorites-reorder drags advertise
	// "text/sf-fav-index" and file drags advertise "Files" — both are
	// ignored, so the overlay only ever reacts to external URL drags.
	useEffect(() => {
		if (typeof window === "undefined") return;

		const dragTypes = (e: DragEvent): string[] => Array.from(e.dataTransfer?.types ?? []);
		const isIgnoredDrag = (e: DragEvent) => {
			const types = dragTypes(e);
			return types.includes("text/sf-fav-index") || types.includes("Files");
		};
		// External URL drags advertise text/uri-list (browsers, most apps) or
		// text/plain (some apps) — the payload is validated again at drop time.
		const isUrlDrag = (e: DragEvent) => {
			const types = dragTypes(e);
			return types.includes("text/uri-list") || types.includes("text/plain");
		};
		// Same guard as the keyboard shortcuts: never fight an open dialog.
		const dialogOpen = () => document.querySelector('[role="dialog"]') !== null;

		const hideOverlay = () => {
			dragDepthRef.current = 0;
			dragActiveRef.current = false;
			setDragActive(false);
		};

		const onDragEnter = (e: DragEvent) => {
			if (isIgnoredDrag(e) || !isUrlDrag(e) || dialogOpen()) return;
			// Enter/leave fire per element and bubble; the depth counter pairs
			// them so moving across children never flickers the overlay.
			dragDepthRef.current += 1;
			dragActiveRef.current = true;
			setDragActive(true);
		};

		const onDragOver = (e: DragEvent) => {
			if (isIgnoredDrag(e) || !isUrlDrag(e) || dialogOpen()) return;
			// preventDefault here is what licenses the window-level drop.
			e.preventDefault();
			if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
			dragActiveRef.current = true;
			setDragActive(true);
		};

		const onDragLeave = (e: DragEvent) => {
			if (isIgnoredDrag(e) || !isUrlDrag(e)) return;
			// Hide only when the drag really left the window: null relatedTarget
			// or coordinates outside the viewport. Child-to-child transitions
			// just unwind the depth counter instead.
			const leftWindow =
				e.relatedTarget === null ||
				e.clientX <= 0 ||
				e.clientY <= 0 ||
				e.clientX >= window.innerWidth ||
				e.clientY >= window.innerHeight;
			if (leftWindow) {
				hideOverlay();
				return;
			}
			dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
			if (dragDepthRef.current === 0) {
				dragActiveRef.current = false;
				setDragActive(false);
			}
		};

		const extractDroppedUrl = (dt: DataTransfer): string => {
			// uri-list lines starting with "#" are comments; prefer the first real one.
			const uriList = dt.getData("text/uri-list");
			if (uriList) {
				const line = uriList
					.split(/\r?\n/)
					.map((entry) => entry.trim())
					.find((entry) => entry.length > 0 && !entry.startsWith("#"));
				if (line) return line;
			}
			return dt.getData("text/plain").trim();
		};

		const onDrop = (e: DragEvent) => {
			if (!e.dataTransfer || isIgnoredDrag(e)) return;
			// The drop only fires because dragover allowed it, so always cancel
			// the browser default (it would otherwise navigate to the URL).
			e.preventDefault();
			hideOverlay();
			const url = extractDroppedUrl(e.dataTransfer);
			if (!/^https?:\/\//i.test(url)) {
				showToast("That does not look like a URL.", "error");
				return;
			}
			if (dialogOpen()) return;
			// Shared add flow (see addFrameFromUrl above the component).
			addFrameFromUrl(url);
		};

		const onDragEnd = () => {
			// A drag aborted with Escape (or otherwise cancelled) ends with
			// dragend and may never send a final dragleave.
			if (dragActiveRef.current) hideOverlay();
		};

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && dragActiveRef.current) hideOverlay();
		};

		window.addEventListener("dragenter", onDragEnter);
		window.addEventListener("dragover", onDragOver);
		window.addEventListener("dragleave", onDragLeave);
		window.addEventListener("drop", onDrop);
		window.addEventListener("dragend", onDragEnd);
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("dragenter", onDragEnter);
			window.removeEventListener("dragover", onDragOver);
			window.removeEventListener("dragleave", onDragLeave);
			window.removeEventListener("drop", onDrop);
			window.removeEventListener("dragend", onDragEnd);
			window.removeEventListener("keydown", onKeyDown);
		};
	}, []);

	// Paste a URL anywhere on the launcher to add it as a frame — the
	// mobile-friendly companion to drag-drop. The listener never calls
	// preventDefault or stopPropagation, so native paste (search box,
	// forms, dialogs) keeps working; matching a URL only offers an
	// action toast on top.
	useEffect(() => {
		if (typeof window === "undefined") return;

		const onPaste = (e: ClipboardEvent) => {
			// Editable fields keep native paste (the search box, forms, …).
			const target = e.target;
			if (
				target instanceof Element &&
				target.closest("input, textarea, select, [contenteditable]")
			) {
				return;
			}
			// Same guard style as the keyboard shortcuts and the drop flow:
			// never fight an open dialog, and let an active URL drag (drop
			// overlay up) own the add-a-frame affordance.
			if (document.querySelector('[role="dialog"]')) return;
			if (dragActiveRef.current) return;

			const dt = e.clipboardData;
			if (!dt) return;
			// uri-list first (same preference as the drop flow; "#" lines are
			// comments), then text/plain.
			let text = "";
			const uriList = dt.getData("text/uri-list");
			if (uriList) {
				const line = uriList
					.split(/\r?\n/)
					.map((entry) => entry.trim())
					.find((entry) => entry.length > 0 && !entry.startsWith("#"));
				if (line) text = line;
			}
			if (!text) text = dt.getData("text/plain").trim();
			// Trivial unwrap pass: some apps quote or angle-bracket URLs.
			const url = text.replace(/^["'<]/, "").replace(/["'>]$/, "");
			// Exactly one http(s) URL — no inner whitespace, nothing else.
			if (!/^https?:\/\/\S+$/i.test(url)) return;

			// No dedupe on purpose: re-pasting just re-offers the toast, and
			// the Add action keeps the drop flow's add-vs-update semantics.
			showToast(`Add ${frameNameFromUrl(url)} as a frame?`, "info", {
				label: "Add",
				onClick: () => addFrameFromUrl(url),
			});
		};

		window.addEventListener("paste", onPaste);
		return () => window.removeEventListener("paste", onPaste);
	}, []);

	// Keyboard shortcuts. Inert while any dialog (frame viewer, shortcuts
	// help) is open — those own their own keys. "/" focuses search, "F"
	// toggles the favorites filter, "?" opens this help dialog.
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			// Ctrl+K / Cmd+K toggles the command palette. The chord works from
			// inside inputs (standard palette behavior), but never while the
			// drop overlay is up, and not while any dialog owns the keys —
			// including the palette itself: while it is open its own window
			// listener closes it (animated), so this handler stays hands-off
			// and the chord can never double-toggle.
			if (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) {
				if (dragActiveRef.current) return;
				if (document.querySelector('[role="dialog"]')) return;
				e.preventDefault();
				// Capture the restore target before the palette opens (see
				// paletteReturnFocusRef above). Sits after the guards so a
				// blocked chord never clobbers a still-valid target.
				paletteReturnFocusRef.current =
					document.activeElement instanceof HTMLElement ? document.activeElement : null;
				setShowPalette(true);
				return;
			}
			if (e.metaKey || e.ctrlKey || e.altKey) return;
			const target = e.target as HTMLElement | null;
			if (
				target &&
				(target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA" ||
					target.tagName === "SELECT" ||
					target.isContentEditable)
			) {
				return;
			}
			if (document.querySelector('[role="dialog"]')) return;

			if (e.key === "/") {
				e.preventDefault();
				searchRef.current?.focus();
			} else if (e.key === "?") {
				e.preventDefault();
				setShowShortcuts((v) => !v);
			} else if (e.key === "f" || e.key === "F") {
				e.preventDefault();
				setFavoritesOnly((v) => !v);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	// Built-ins first, then the user's custom frames; tagless custom
	// frames fall back to the shared "General" tag.
	const allSources = useMemo<SourceData[]>(() => {
		const merged = customFrames.map<SourceData>((frame) => ({
			name: frame.name,
			URL: frame.URL,
			description: frame.description,
			tags: frame.tags.length > 0 ? frame.tags : ["General"],
			kind: frame.kind,
		}));
		return [...sources, ...merged];
	}, [customFrames]);

	// When each custom frame was added (epoch ms), for the "Date added"
	// sort. Built-ins are intentionally absent (they read as "oldest").
	const addedAt = useMemo(() => {
		const map = new Map<string, number>();
		for (const frame of customFrames) {
			if (typeof frame.addedAt === "number") map.set(frame.URL, frame.addedAt);
		}
		return map;
	}, [customFrames]);

	// Sorted union of every tag across all sources — the menu's option list.
	const allTags = useMemo(() => {
		const set = new Set<string>();
		for (const source of allSources) {
			for (const tag of getSourceTags(source)) set.add(tag);
		}
		return Array.from(set).sort();
	}, [allSources]);

	// How many frames carry each tag — shown as faint counts in the menu.
	const tagCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		for (const source of allSources) {
			for (const tag of getSourceTags(source)) {
				counts[tag] = (counts[tag] ?? 0) + 1;
			}
		}
		return counts;
	}, [allSources]);

	const favoritesSet = useMemo(() => new Set(favorites), [favorites]);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		const list = allSources.filter((source) => {
			const tags = getSourceTags(source);
			// Union semantics: a source matches when ANY of its tags is selected.
			if (selectedTags.length > 0 && !tags.some((tag) => selectedTags.includes(tag))) return false;
			if (q) {
				const nameMatch = source.name.toLowerCase().includes(q);
				const descMatch = (source.description ?? "").toLowerCase().includes(q);
				const tagMatch = tags.some((tag) => tag.toLowerCase().includes(q));
				if (!nameMatch && !descMatch && !tagMatch) return false;
			}
			if (favoritesOnly && !favoritesSet.has(source.URL)) return false;
			return true;
		});
		// The favorites view honors the saved (drag-reorderable) order. The
		// launcher sort is deliberately NOT applied there: the saved order IS
		// the drag-reorder result and a second sort would fight it — the
		// select is dimmed/disabled while favoritesOnly for the same reason.
		if (favoritesOnly) {
			const rank = new Map(favorites.map((url, i) => [url, i]));
			list.sort(
				(a, b) =>
					(rank.get(a.URL) ?? Number.MAX_SAFE_INTEGER) -
					(rank.get(b.URL) ?? Number.MAX_SAFE_INTEGER),
			);
			return list;
		}
		// Normal view: the sort is applied AFTER filtering, so search/tags
		// and the sort compose (filter the matches first, then order them).
		if (sort === "alpha") {
			// Case-insensitive by name; equal names keep the default order
			// (Array#sort is stable in every supported engine).
			list.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
		} else if (sort === "zeta") {
			// Mirror of "alpha" — same case-insensitive comparison, reversed.
			list.sort((a, b) => b.name.toLowerCase().localeCompare(a.name.toLowerCase()));
		} else if (sort === "added") {
			// Newest additions first. Custom frames carry a real addedAt
			// timestamp; built-ins have none and count as the oldest (0), so
			// they keep their built-in order after every user-added frame.
			// Ties fall back to the built-ins-then-custom order.
			const defaultRank = new Map(allSources.map((source, i) => [source.URL, i]));
			list.sort(
				(a, b) =>
					(addedAt.get(b.URL) ?? 0) - (addedAt.get(a.URL) ?? 0) ||
					(defaultRank.get(a.URL) ?? 0) - (defaultRank.get(b.URL) ?? 0),
			);
		} else if (sort === "opened") {
			// Most-opened first (a frame never opened counts as 0); ties
			// fall back to the default built-ins-then-custom order.
			const defaultRank = new Map(allSources.map((source, i) => [source.URL, i]));
			list.sort(
				(a, b) =>
					(openCounts[b.URL] ?? 0) - (openCounts[a.URL] ?? 0) ||
					(defaultRank.get(a.URL) ?? 0) - (defaultRank.get(b.URL) ?? 0),
			);
		}
		return list;
	}, [
		query,
		selectedTags,
		favoritesOnly,
		favoritesSet,
		favorites,
		allSources,
		sort,
		openCounts,
		addedAt,
	]);

	const toggleFavorite = (url: string) => {
		setFavorites(toggleFavoriteUrl(url));
	};

	const handleReorderFavorite = (from: number, to: number) => {
		setFavorites(reorderFavorite(from, to));
	};

	// Persist on change (writeSortPref validates); the state update
	// re-sorts the grid. Storage failures degrade to session-only.
	const handleSortChange = (next: SortPref) => {
		setSort(writeSortPref(next));
	};

	const toggleTag = (tag: string) => {
		setSelectedTags((prev) =>
			prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
		);
	};

	const resetFilters = () => {
		setQuery("");
		setSelectedTags([]);
		setFavoritesOnly(false);
	};

	const handleFrameOpened = (url: string, title?: string) => {
		setRecent(pushRecent(url, title ?? url));
		recordOpen(url);
	};

	// The palette's open action mirrors the card Open control exactly:
	// link kinds leave the app in a new tab (no recents/open-count
	// recording — same as the card), iframe kinds run the same
	// handleFrameOpened the cards use and open the shared viewer overlay.
	const handlePaletteOpen = (source: SourceData) => {
		if (source.kind === "link") {
			window.open(source.URL, "_blank", "noopener,noreferrer");
			return;
		}
		handleFrameOpened(source.URL, source.name);
		paletteOpenedViewerRef.current = true;
		setPaletteFrame({ url: source.URL, title: source.name });
	};

	// The palette closed (Escape, backdrop, the chord again, a link row):
	// a close that never opened a viewer must clear the restore target, or
	// a later viewer close would yank focus to something long out of date.
	const handlePaletteClose = () => {
		setShowPalette(false);
		if (paletteOpenedViewerRef.current) {
			paletteOpenedViewerRef.current = false;
		} else {
			paletteReturnFocusRef.current = null;
		}
	};

	// The palette-opened viewer closed. The viewer's own trap restores to
	// its captured element only when still connected — for a
	// palette-opened viewer that target is gone (or body), so this fills
	// the gap with the element focused before Ctrl+K. The card-opened
	// viewer is a separate FrameContent instance (inside FramesList) whose
	// trap restores to its card trigger, so there is no double restore.
	// rAF defers the focus past the viewer's unmount commit — and past
	// the trap's own restore, which is a harmless no-op when both land on
	// the same element; try/catch covers a target detached in between.
	const handlePaletteFrameClose = () => {
		setPaletteFrame(null);
		paletteOpenedViewerRef.current = false;
		const target = paletteReturnFocusRef.current;
		paletteReturnFocusRef.current = null;
		if (!target || !target.isConnected) return;
		window.requestAnimationFrame(() => {
			try {
				target.focus();
			} catch {
				// Detached between the isConnected check and this frame.
			}
		});
	};

	const handleClearRecent = () => {
		setRecent(clearRecent());
	};

	return (
		<div className="flex min-h-dvh flex-col">
			<Header />

			<main id="main" tabIndex={-1} className="flex-1">
				<section className="border-b border-hairline">
					<div className="mx-auto w-full max-w-6xl px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:px-8">
						{/* The one bold element: the product's own name, framed by the
                                                    same viewfinder brackets the cards answer to. */}
						<div className="relative mt-2 inline-block px-6 py-5 sm:px-8">
							<span aria-hidden className="pointer-events-none absolute inset-0">
								<span className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-accent" />
								<span className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-accent" />
								<span className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-accent" />
								<span className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-accent" />
							</span>
							<h1 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl lg:text-6xl">
								Source Frames
							</h1>
						</div>

						<p className="mt-4 max-w-xl text-base text-muted sm:text-lg">
							Open tools, references, and live readouts in framed overlays without leaving the page.
						</p>

						<p className="mt-4 flex items-center gap-2.5 text-xs text-muted">
							<span className="tabular-nums">{allSources.length} frames</span>
							<span aria-hidden className="h-3 w-px bg-hairline" />
							<span className="tabular-nums">{allTags.length} tags</span>
							<span aria-hidden className="h-3 w-px bg-hairline" />
							<span className="tabular-nums">{favorites.length} favorites</span>
						</p>

						<div className="relative mt-8 max-w-xl">
							<span
								aria-hidden
								className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
							>
								<SearchIcon />
							</span>
							<input
								ref={searchRef}
								type="search"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Search frames"
								aria-label="Search frames"
								className="h-12 w-full rounded-xl border border-hairline bg-surface pl-11 pr-12 text-sm text-ink shadow-sm transition duration-200 placeholder:text-muted/70 focus:border-accent/60 focus:outline-none focus:ring-4 focus:ring-accent/25 [&::-webkit-search-cancel-button]:hidden"
							/>
							{query.length === 0 ? (
								<kbd
									aria-hidden
									className="pointer-events-none absolute right-3.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-hairline bg-raised px-1.5 py-0.5 font-mono text-[11px] text-muted sm:block"
								>
									/
								</kbd>
							) : (
								<button
									type="button"
									aria-label="Clear search"
									title="Clear search"
									onClick={() => {
										setQuery("");
										searchRef.current?.focus();
									}}
									className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg border border-transparent text-muted transition duration-150 hover:border-hairline hover:bg-raised hover:text-ink active:scale-90"
								>
									<XIcon className="h-3.5 w-3.5" />
								</button>
							)}
						</div>
					</div>
				</section>

				<section
					aria-label="Filters and results"
					className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8"
				>
					<div className="flex flex-wrap items-center gap-2 border-b border-hairline pb-5">
						<div
							role="group"
							aria-label="Filter by tags"
							className="flex flex-wrap items-center gap-2"
						>
							<TagsMenu
								allTags={allTags}
								tagCounts={tagCounts}
								selected={selectedTags}
								onToggle={toggleTag}
								onClear={() => setSelectedTags([])}
							/>

							{selectedTags.map((tag) => (
								<button
									key={tag}
									type="button"
									onClick={() => toggleTag(tag)}
									aria-label={`Remove tag ${tag}`}
									className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-ink transition duration-150 hover:border-accent/60"
								>
									{tag}
									<XIcon />
								</button>
							))}
						</div>

						<div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
							<button
								type="button"
								aria-pressed={favoritesOnly}
								onClick={() => setFavoritesOnly(!favoritesOnly)}
								className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition duration-150 ${
									favoritesOnly
										? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-500"
										: "border-hairline text-muted hover:border-muted/60 hover:text-ink"
								}`}
							>
								<HeartIcon filled={favoritesOnly} />
								Favorites
								{favorites.length > 0 ? (
									<span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-hairline bg-raised px-1 text-[10px] font-semibold leading-none text-muted">
										{favorites.length}
									</span>
								) : null}
							</button>

							{/* Launcher sort. Disabled (and dimmed) while favoritesOnly because
							    that view is ordered by the saved, drag-reorderable favorites list —
							    a second order would fight the reorder semantics (see the filtered
							    memo). A native <select> keeps the control mobile-friendly and
							    keyboard-native; it sizes to its widest option, so switching
							    entries never shifts the row layout. */}
							<div
								title={favoritesOnly ? "Favorites keep your saved order" : undefined}
								className={`inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1.5 text-sm transition duration-150 focus-within:border-accent/60 focus-within:ring-4 focus-within:ring-accent/25 ${
									favoritesOnly ? "opacity-60" : "hover:border-accent/40 active:scale-[0.99]"
								}`}
							>
								<label htmlFor="frame-sort" className="sr-only">
									Sort frames
								</label>
								<span aria-hidden className="text-muted">
									Sort:
								</span>
								<select
									id="frame-sort"
									value={sort}
									disabled={favoritesOnly}
									onChange={(e) => handleSortChange(e.target.value as SortPref)}
									title={favoritesOnly ? "Favorites keep your saved order" : undefined}
									className="cursor-pointer appearance-none bg-transparent pr-1 text-sm text-ink focus:outline-none disabled:cursor-not-allowed"
								>
									<option value="alpha">A–Z</option>
									<option value="zeta">Z–A</option>
									<option value="added">Date added</option>
									<option value="opened">Most opened</option>
								</select>
								<span aria-hidden className="pointer-events-none -ml-0.5 text-muted">
									<ChevronDownIcon />
								</span>
							</div>

							<p role="status" className="text-xs text-muted">
								{filtered.length} of {allSources.length} shown
							</p>
						</div>
					</div>

					<div className="pt-6">
						<FramesList
							filtered={filtered}
							favorites={favorites}
							favoritesOnly={favoritesOnly}
							query={query}
							selectedTags={selectedTags}
							onToggleFavorite={toggleFavorite}
							onReorderFavorite={handleReorderFavorite}
							onResetFilters={resetFilters}
							recent={recent}
							onClearRecent={handleClearRecent}
							onFrameOpened={handleFrameOpened}
						/>
					</div>
				</section>
			</main>

			{/* Drop-a-URL overlay: pointer-events-none keeps the content below
			    interactive (drop is handled at window level); z-50 stays under
			    the toast stack (z-[60]). */}
			{dragActive ? (
				<div className="pointer-events-none fixed inset-0 z-50 bg-page/80 backdrop-blur-sm">
					<div className="flex h-full items-center justify-center px-6">
						<div className="animate-drop-pulse rounded-2xl border-2 border-dashed border-accent/60 bg-surface p-8 text-center shadow-lg">
							<span
								aria-hidden
								className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent"
							>
								<DownloadIcon />
							</span>
							<p role="status" className="mt-4 font-display text-lg font-semibold text-ink">
								Drop to add a frame
							</p>
							<p className="mt-1 text-sm text-muted">Drop a URL to add it as a custom frame.</p>
						</div>
					</div>
				</div>
			) : null}

			{showShortcuts ? <ShortcutsDialog onClose={() => setShowShortcuts(false)} /> : null}

			{/* Command palette: keep-mounted, gated on showPalette. Rendered
			    before the palette-frame viewer so, when a row opens the viewer,
			    the viewer (later in the DOM, same z-index) paints above the
			    palette's exit animation and its mount focus wins. */}
			<CommandPalette
				open={showPalette}
				onClose={handlePaletteClose}
				onOpenFrame={handlePaletteOpen}
				sources={allSources}
			/>

			{paletteFrame ? (
				<FrameContent
					url={paletteFrame.url}
					title={paletteFrame.title}
					onClose={handlePaletteFrameClose}
				/>
			) : null}

			<Footer />
		</div>
	);
}
