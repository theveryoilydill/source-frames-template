import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { getSourceTags, type SourceData } from "./data/sources";
import { OPEN_COUNTS_EVENT, readOpenCounts } from "./data/openCounts";
import { useFocusTrap } from "./useFocusTrap";

const LIST_ID = "sf-command-palette-list";

const kbdClass =
	"rounded-md border border-hairline bg-raised px-1.5 py-0.5 font-mono text-[11px] text-muted";

const tagChipClass =
	"inline-flex shrink-0 items-center rounded-full border border-hairline bg-raised px-1.5 py-0.5 text-[10px] leading-none text-muted";

const kindChipClass =
	"shrink-0 rounded-full border border-hairline bg-raised px-2 py-0.5 text-[10px] text-muted";

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

type CommandPaletteProps = {
	open: boolean;
	onClose: () => void;
	onOpenFrame: (source: SourceData) => void;
	sources: SourceData[];
};

/**
 * Ctrl+K / Cmd+K command palette over the launcher's frames.
 *
 * Mounting follows the ShortcutsDialog pattern with one twist: the component
 * stays mounted and gates its DOM on the `open` prop (returning null while
 * closed). Every close path — Escape, backdrop click, Ctrl/Cmd+K again,
 * activating a row — funnels through the same ref-guarded `beginClose` with
 * the shared overlay-out exit animation and a 260 ms safety timer.
 *
 * Keys live in two places, mirroring the other dialogs:
 *
 * - useFocusTrap owns container-level Tab cycling and signals Escape via
 *   `onEscape` (search input is the initial focus; focus restores to the
 *   trigger on close, the hook default).
 * - A window-level listener (added while the palette is up) also answers
 *   Escape and the Ctrl/Cmd+K chord itself. The launcher's shortcut guard
 *   treats ANY open [role=dialog] as blocking, so this self-close is what
 *   keeps the chord toggleable while the palette is open without the guard
 *   needing a palette exception — both listeners funnel through the same
 *   idempotent `beginClose`.
 *
 * Opening a row hands the source to `onOpenFrame` (the launcher decides:
 * iframe kinds get the shared viewer, link kinds a new tab) and then exits
 * with the same animation, so a viewer opened from a row crossfades under
 * the fading palette.
 *
 * A11y: combobox-style listbox — focus stays on the search input and the
 * active row is announced via aria-activedescendant (rows are inert
 * role="option" elements). Filtering is a case-insensitive substring match
 * on name + tags; an empty query lists everything.
 */
export default function CommandPalette({
	open,
	onClose,
	onOpenFrame,
	sources,
}: CommandPaletteProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
	const isClosingRef = useRef(false);
	const closeTimerRef = useRef<number | null>(null);
	const [isClosing, setIsClosing] = useState(false);
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const [openCounts, setOpenCounts] = useState<Record<string, number>>({});

	// Open counts power the per-row N× badge — read (and subscribed to) right
	// here, the same self-contained pattern as the cards and the recents strip.
	useEffect(() => {
		if (typeof window === "undefined") return;
		setOpenCounts(readOpenCounts());
		const onCounts = () => setOpenCounts(readOpenCounts());
		window.addEventListener(OPEN_COUNTS_EVENT, onCounts as EventListener);
		return () => window.removeEventListener(OPEN_COUNTS_EVENT, onCounts as EventListener);
	}, []);

	/** Every close path funnels through the overlay-out exit animation. */
	const beginClose = useCallback(() => {
		if (isClosingRef.current) return;
		isClosingRef.current = true;
		setIsClosing(true);
		// Safety net: background tabs throttle CSS animations, so
		// animationend may never fire — close anyway.
		closeTimerRef.current = window.setTimeout(() => {
			closeTimerRef.current = null;
			if (!isClosingRef.current) return;
			isClosingRef.current = false;
			setIsClosing(false);
			onClose();
		}, 260);
	}, [onClose]);

	// If the gate unmounts the overlay early, a pending close timer must not
	// fire into an unmounted component.
	useEffect(
		() => () => {
			if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
		},
		[],
	);

	// Fresh search on every open; the previous query never lingers.
	useEffect(() => {
		if (!open) return;
		setQuery("");
		setActiveIndex(0);
	}, [open]);

	// Window-level Escape + Ctrl/Cmd+K while the palette is up. The focus trap
	// also signals Escape from the container (both funnel through the
	// idempotent beginClose, the accepted double-call of the other dialogs);
	// the window listener covers the chord and the odd case of focus landing
	// outside the container.
	const active = open && !isClosing;
	useEffect(() => {
		if (!active) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				beginClose();
				return;
			}
			if (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				beginClose();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [active, beginClose]);

	// Body scroll lock spans the open state but NOT the exit animation:
	// releasing it at beginClose lets a viewer opened from a row in the same
	// commit capture the unlocked overflow value and restore it correctly on
	// its own close (the ShortcutsDialog lock would restore "hidden" over it).
	useEffect(() => {
		if (!active) return;
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prevOverflow;
		};
	}, [active]);

	useFocusTrap(active, containerRef, {
		initialFocus: () => inputRef.current,
		onEscape: beginClose,
	});

	// Case-insensitive substring match on name + tags; an empty query is the
	// full list. (The launcher search also scans descriptions; the palette
	// stays name+tags.)
	const matches = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return sources;
		return sources.filter(
			(source) =>
				source.name.toLowerCase().includes(q) ||
				getSourceTags(source).some((tag) => tag.toLowerCase().includes(q)),
		);
	}, [sources, query]);

	// Keep the active row inside the list even when it shrinks underneath it
	// (typing, or a custom frame disappearing while the palette is open).
	useEffect(() => {
		if (activeIndex > matches.length - 1) setActiveIndex(Math.max(0, matches.length - 1));
	}, [activeIndex, matches.length]);

	// Keyboard navigation keeps the active row visible (instant, and only as
	// far as "nearest" — the page behind the overlay never scrolls).
	useEffect(() => {
		rowRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
	}, [activeIndex, matches.length]);

	const activate = (source: SourceData) => {
		// Open first, then exit: a viewer mounts under the fading palette for
		// a short crossfade instead of a two-step delay.
		onOpenFrame(source);
		beginClose();
	};

	const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			e.preventDefault();
			if (matches.length === 0) return;
			const step = e.key === "ArrowDown" ? 1 : matches.length - 1;
			setActiveIndex((i) => (i + step) % matches.length);
		} else if (e.key === "Home") {
			e.preventDefault();
			if (matches.length > 0) setActiveIndex(0);
		} else if (e.key === "End") {
			e.preventDefault();
			if (matches.length > 0) setActiveIndex(matches.length - 1);
		} else if (e.key === "Enter") {
			e.preventDefault();
			const source = matches[activeIndex];
			if (source) activate(source);
		}
	};

	if (!open && !isClosing) return null;

	const activeId = matches.length > 0 ? `${LIST_ID}-option-${activeIndex}` : undefined;

	return (
		<div
			ref={containerRef}
			role="dialog"
			aria-modal="true"
			aria-label="Command palette"
			data-sf-command-palette=""
			onAnimationEnd={(e) => {
				// Only the overlay's own overlay-out run closes; child animation
				// events bubble and must be ignored.
				if (!isClosing || e.target !== e.currentTarget) return;
				if (closeTimerRef.current !== null) {
					window.clearTimeout(closeTimerRef.current);
					closeTimerRef.current = null;
				}
				isClosingRef.current = false;
				setIsClosing(false);
				onClose();
			}}
			onClick={(e) => {
				if (e.target === e.currentTarget) beginClose();
			}}
			className={`${
				isClosing ? "animate-overlay-out" : "animate-overlay-in"
			} fixed inset-0 z-[9999] bg-black/80 px-4 backdrop-blur-sm`}
		>
			<div className="mx-auto mt-[10vh] w-full max-w-lg overflow-hidden rounded-2xl border border-hairline bg-surface shadow-lg">
				<div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
					<span aria-hidden className="shrink-0 text-muted">
						<SearchIcon />
					</span>
					<input
						ref={inputRef}
						type="text"
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setActiveIndex(0);
						}}
						onKeyDown={onInputKeyDown}
						placeholder="Search frames..."
						aria-label="Search frames"
						aria-activedescendant={activeId}
						autoComplete="off"
						spellCheck={false}
						className="h-8 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted/70 focus:outline-none"
					/>
					<kbd className={kbdClass}>Esc</kbd>
				</div>

				{matches.length === 0 ? (
					<p className="px-4 py-8 text-center text-sm text-muted">No frames match</p>
				) : (
					<div
						id={LIST_ID}
						role="listbox"
						aria-label="Frames"
						className="sf-thin-scroll max-h-80 divide-y divide-hairline overflow-y-auto"
					>
						{matches.map((source, i) => {
							const openCount = openCounts[source.URL] ?? 0;
							const tags = getSourceTags(source);
							return (
								<div
									key={source.URL}
									ref={(el) => {
										rowRefs.current[i] = el;
									}}
									id={`${LIST_ID}-option-${i}`}
									role="option"
									aria-selected={i === activeIndex}
									onMouseEnter={() => setActiveIndex(i)}
									onClick={() => activate(source)}
									className={`flex cursor-pointer items-center gap-2 px-4 py-2.5 transition duration-150 ${
										i === activeIndex ? "bg-accent/10 text-accent" : "text-ink"
									}`}
								>
									<span className="min-w-0 truncate text-sm font-medium">{source.name}</span>
									{tags.slice(0, 2).map((tag) => (
										<span key={tag} className={tagChipClass}>
											{tag}
										</span>
									))}
									<div className="ml-auto flex shrink-0 items-center gap-1.5">
										<span className={kindChipClass}>
											{source.kind === "link" ? "Link" : "Frame"}
										</span>
										{openCount >= 2 ? (
											<span
												title={`Opened ${openCount} times`}
												className="shrink-0 text-[10px] tabular-nums text-muted"
											>
												{openCount}×
											</span>
										) : null}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
