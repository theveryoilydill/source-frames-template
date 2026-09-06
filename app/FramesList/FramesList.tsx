import { useLayoutEffect, useRef, useState } from "react";
import FrameItem from "./FrameItem";
import type { SourceData } from "../data/sources";
import type { RecentEntry } from "../data/recent";
import RecentFrames from "../RecentFrames";
import FrameContent from "../FrameContent/FrameContent";

/**
 * Decorative viewfinder motif for the empty state — echoes the Logo mark:
 * four rounded corner brackets around a faint, half-exposed inner frame.
 * Purely decorative (aria-hidden); currentColor only so it tints with the
 * theme.
 */
function EmptyStateArt() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 32 32"
			fill="none"
			aria-hidden
			className="h-16 w-16 text-muted"
		>
			{/* Corner brackets. */}
			<g
				stroke="currentColor"
				strokeWidth={2.5}
				strokeLinecap="round"
				strokeLinejoin="round"
				opacity={0.5}
			>
				<path d="M4 11V7a3 3 0 0 1 3-3h4" />
				<path d="M21 4h4a3 3 0 0 1 3 3v4" />
				<path d="M28 21v4a3 3 0 0 1-3 3h-4" />
				<path d="M11 28H7a3 3 0 0 1-3-3v-4" />
			</g>
			{/* Inner frame, half-exposed, kept faint. */}
			<path d="M16 10h-4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4Z" fill="currentColor" opacity={0.18} />
			<path d="M16 10h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4Z" fill="currentColor" opacity={0.1} />
		</svg>
	);
}

/**
 * Renders the (already filtered) frame card grid and hosts the fullscreen
 * frame viewer overlay. Cards enter with a short stagger; when the favorites
 * filter is active, favorited cards can be drag-reordered (touch long-press, drag, or Alt+Arrow) to
 * change the persisted favorites order. The empty state names the filters
 * that hid everything when the route passes the optional query/tag echoes.
 */
export function FramesList({
	filtered,
	favorites = [],
	favoritesOnly = false,
	query = "",
	selectedTags = [],
	onToggleFavorite,
	onReorderFavorite,
	onResetFilters,
	recent = [],
	onClearRecent,
	onFrameOpened,
}: {
	filtered: SourceData[];
	favorites?: string[];
	favoritesOnly?: boolean;
	/** Live filter echoes for the empty-state copy (optional). */
	query?: string;
	selectedTags?: string[];
	onToggleFavorite?: (url: string) => void;
	onReorderFavorite?: (from: number, to: number) => void;
	onResetFilters?: () => void;
	recent?: RecentEntry[];
	onClearRecent?: () => void;
	onFrameOpened?: (url: string, title?: string) => void;
}) {
	const [openUrl, setOpenUrl] = useState<string | null>(null);
	const [openTitle, setOpenTitle] = useState<string | undefined>(undefined);

	const closeOverlay = () => {
		setOpenUrl(null);
		setOpenTitle(undefined);
	};

	const openFrame = (url: string, title?: string) => {
		setOpenUrl(url);
		setOpenTitle(title);
		onFrameOpened?.(url, title);
	};

	// Last-painted card positions (per URL) — the "F" of the FLIP reorder
	// animation: each commit records where cards ended up; the next commit
	// animates moved cards from that old spot to the new one (First-Last-
	// Invert-Play) instead of letting them teleport.
	const gridRef = useRef<HTMLDivElement>(null);
	const prevRectsRef = useRef<Map<string, { left: number; top: number }>>(new Map());

	// Runs whenever the card order changes — favorites drag/Alt+Arrow
	// reordering, a sort switch, or filtering. New cards have no previous
	// position and simply enter; existing ones glide. Reduced-motion users
	// get the jump straight to the final layout.
	const orderSignature = filtered.map((source) => source.URL).join("\n");
	useLayoutEffect(() => {
		const grid = gridRef.current;
		if (!grid) return;
		const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const prevRects = prevRectsRef.current;
		const nextRects = new Map<string, { left: number; top: number }>();
		for (const el of Array.from(grid.querySelectorAll<HTMLElement>("[data-sf-url]"))) {
			const url = el.dataset.sfUrl;
			if (!url) continue;
			const rect = el.getBoundingClientRect();
			nextRects.set(url, { left: rect.left, top: rect.top });
			const prev = prevRects.get(url);
			if (!prev || reducedMotion) continue;
			const dx = prev.left - rect.left;
			const dy = prev.top - rect.top;
			if (dx === 0 && dy === 0) continue;
			el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], {
				duration: 260,
				easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
			});
		}
		prevRectsRef.current = nextRects;
	}, [orderSignature]);

	// Empty-state copy that names the active filters instead of guessing.
	// query/selectedTags are optional echoes; when the route does not
	// pass them, the fallback line stays accurate for any combination.
	const trimmedQuery = query.trim();
	const tagCount = selectedTags.length;
	// With favorites-only on and nothing saved, that fact alone explains
	// the empty grid no matter what else is filtered.
	const favoritesEmpty = favoritesOnly && favorites.length === 0;
	const reasons: string[] = [];
	if (trimmedQuery) reasons.push(`the search “${trimmedQuery}”`);
	if (tagCount === 1) reasons.push(`the tag “${selectedTags[0]}”`);
	else if (tagCount > 1) reasons.push(`${tagCount} selected tags`);
	if (favoritesOnly) reasons.push("the favorites filter");
	const reasonText =
		reasons.length === 0
			? ""
			: reasons.length === 1
				? reasons[0]
				: `${reasons.slice(0, -1).join(", ")} or ${reasons[reasons.length - 1]}`;

	return (
		<section aria-label="Frame results">
			<RecentFrames
				recent={recent}
				onReopen={(entry) => openFrame(entry.URL, entry.name)}
				onClear={() => onClearRecent?.()}
			/>
			{filtered.length === 0 ? (
				<div className="animate-fade-in flex flex-col items-center rounded-xl border border-dashed border-hairline bg-surface/50 px-6 py-20 text-center">
					<EmptyStateArt />
					<p className="mt-6 font-display text-xl font-semibold tracking-tight text-ink">
						{favoritesEmpty ? "No favorites yet" : "No frames match"}
					</p>
					<p className="mt-2 max-w-sm text-sm leading-6 text-muted">
						{favoritesEmpty
							? "Frames you favorite with the heart will appear here."
							: reasonText
								? `Nothing matches ${reasonText}. Try loosening or clearing your filters.`
								: "Try a different search or tag, or clear the favorites filter."}
					</p>
					{onResetFilters ? (
						<button
							type="button"
							onClick={onResetFilters}
							className="mt-6 inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition duration-150 hover:opacity-90 active:scale-[0.98]"
						>
							Clear filters
						</button>
					) : null}
				</div>
			) : (
				<div ref={gridRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-sf-grid>
					{filtered.map((source, i) => (
						<FrameItem
							key={source.URL}
							source={source}
							isFavorite={favorites.includes(source.URL)}
							onToggleFavorite={onToggleFavorite}
							onOpen={openFrame}
							index={i}
							reorderEnabled={Boolean(favoritesOnly && onReorderFavorite)}
							orderIndex={favorites.indexOf(source.URL)}
							onReorderFavorite={onReorderFavorite}
							entranceDelay={Math.min(i, 8) * 40}
						/>
					))}
				</div>
			)}

			{openUrl ? <FrameContent url={openUrl} title={openTitle} onClose={closeOverlay} /> : null}
		</section>
	);
}

export default FramesList;
