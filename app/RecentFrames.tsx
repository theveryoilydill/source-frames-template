import { useCallback, useEffect, useRef, useState } from "react";
import type { RecentEntry } from "./data/recent";
import { formatRelativeTime } from "./data/recent";
import { OPEN_COUNTS_EVENT, readOpenCounts } from "./data/openCounts";

/**
 * Lucide-style chevron for the strip scroll buttons (currentColor only).
 */
function ChevronIcon({ back }: { back: boolean }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			className="h-4 w-4"
			aria-hidden
		>
			{/* Lucide chevron-left / chevron-right paths. */}
			<path d={back ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
		</svg>
	);
}

const chevronButtonClass =
	"hidden h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface text-muted transition duration-150 hover:border-accent/40 hover:bg-raised hover:text-ink active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 sm:inline-flex";

/**
 * Quick-access row of recently opened frames, shown above the grid. Clicking
 * a chip reopens that frame in the viewer without hunting through filters.
 * The row stays on one line and scrolls horizontally when it does not fit;
 * faint edge fades appear only on the sides that hide more chips. While it
 * overflows, sm+ screens get chevron buttons that page the strip back and
 * forward (mobile keeps native swipe; the strip scrollbar stays thin).
 */
export function RecentFrames({
	recent,
	onReopen,
	onClear,
}: {
	recent: RecentEntry[];
	onReopen: (entry: RecentEntry) => void;
	onClear: () => void;
}) {
	// Read (and subscribed to) here — same self-contained pattern as the
	// cards, so no extra props need to cross the FramesList boundary.
	const [openCounts, setOpenCounts] = useState<Record<string, number>>({});
	useEffect(() => {
		if (typeof window === "undefined") return;
		setOpenCounts(readOpenCounts());
		const onCounts = () => setOpenCounts(readOpenCounts());
		window.addEventListener(OPEN_COUNTS_EVENT, onCounts as EventListener);
		return () => window.removeEventListener(OPEN_COUNTS_EVENT, onCounts as EventListener);
	}, []);

	// Edge-fade bookkeeping: which sides of the strip currently hide chips.
	const scrollRef = useRef<HTMLDivElement>(null);
	const [edgeFade, setEdgeFade] = useState({ left: false, right: false });
	const updateEdgeFade = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		// 1px of slack keeps rounding from pinning a fade on permanently.
		setEdgeFade({
			left: el.scrollLeft > 1,
			right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
		});
	}, []);
	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		updateEdgeFade();
		el.addEventListener("scroll", updateEdgeFade, { passive: true });
		window.addEventListener("resize", updateEdgeFade);
		// The strip's own box may not resize when chips come and go, so the
		// recents length is a dependency too (ResizeObserver covers resizes).
		let observer: ResizeObserver | undefined;
		if (typeof ResizeObserver !== "undefined") {
			observer = new ResizeObserver(updateEdgeFade);
			observer.observe(el);
		}
		return () => {
			el.removeEventListener("scroll", updateEdgeFade);
			window.removeEventListener("resize", updateEdgeFade);
			observer?.disconnect();
		};
	}, [updateEdgeFade, recent.length]);

	// Strip paging: one chevron press scrolls about two cards of chips.
	// Smooth, unless the user prefers reduced motion.
	const scrollStrip = useCallback((back: boolean) => {
		const el = scrollRef.current;
		if (!el) return;
		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		el.scrollBy({ left: back ? -240 : 240, behavior: reduceMotion ? "auto" : "smooth" });
	}, []);

	if (recent.length === 0) return null;

	// Chevrons exist only while the strip overflows — the exact measurement
	// that drives the edge fades (left/right = that side hides chips), so no
	// extra listeners are needed and the disabled ends come for free.
	const showChevrons = edgeFade.left || edgeFade.right;

	// Mask only the edges that currently hide content (the fade goes to
	// nothing, so it reads correctly in both themes with no painted bar).
	// NOTE: an inline style rather than the arbitrary Tailwind utility of
	// the same name, because oxfmt deletes the bracket-plus-letter sequence
	// that starts the arbitrary class syntax, corrupting it on every pass.
	const maskImage =
		edgeFade.left && edgeFade.right
			? "linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)"
			: edgeFade.right
				? "linear-gradient(to right, black calc(100% - 16px), transparent)"
				: edgeFade.left
					? "linear-gradient(to right, transparent, black 16px)"
					: undefined;

	return (
		<div className="animate-fade-in relative mb-5 flex items-center gap-1.5">
			{showChevrons ? (
				<button
					type="button"
					aria-label="Scroll recents back"
					aria-disabled={!edgeFade.left || undefined}
					disabled={!edgeFade.left}
					onClick={() => scrollStrip(true)}
					className={chevronButtonClass}
				>
					<ChevronIcon back />
				</button>
			) : null}
			<div
				ref={scrollRef}
				className="sf-thin-scroll flex min-w-0 flex-1 items-center gap-2 overflow-x-auto"
				style={maskImage ? { maskImage, WebkitMaskImage: maskImage } : undefined}
			>
				<span className="shrink-0 whitespace-nowrap text-xs text-muted">Recent</span>
				{recent.map((entry) => {
					const openCount = openCounts[entry.URL] ?? 0;
					const relative =
						entry.openedAt !== undefined ? formatRelativeTime(entry.openedAt) : undefined;
					// Fresh opens render as "now"; give that time a stronger shade than
					// the muted older ages ("just now" is the long form used in titles).
					const fresh = relative === "now" || relative === "just now";
					const base = entry.openedAt
						? `Open ${entry.name} — last opened ${formatRelativeTime(entry.openedAt, true)}`
						: `Open ${entry.name}`;
					// One accessible name, announced once: aria-label overrides the
					// button's visible content (no sr-only span — inside a button it
					// would concatenate with the text and be read twice).
					const label = openCount >= 2 ? `${base} · ${openCount} opens` : base;
					return (
						<button
							key={entry.URL}
							type="button"
							onClick={() => onReopen(entry)}
							title={label}
							aria-label={label}
							className="inline-flex max-w-[220px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-ink transition duration-150 hover:border-accent/40 hover:bg-raised active:scale-[0.98]"
						>
							<span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" />
							<span className="truncate">{entry.name}</span>
							{relative !== undefined ? (
								<span
									className={`shrink-0 text-[10px] font-normal ${fresh ? "text-ink/80" : "text-muted/80"}`}
								>
									{relative}
								</span>
							) : null}
						</button>
					);
				})}
				<button
					type="button"
					onClick={onClear}
					className="ml-1 shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-xs text-muted transition duration-150 hover:bg-raised hover:text-ink"
				>
					Clear
				</button>
			</div>
			{showChevrons ? (
				<button
					type="button"
					aria-label="Scroll recents forward"
					aria-disabled={!edgeFade.right || undefined}
					disabled={!edgeFade.right}
					onClick={() => scrollStrip(false)}
					className={chevronButtonClass}
				>
					<ChevronIcon back={false} />
				</button>
			) : null}
		</div>
	);
}

export default RecentFrames;
