import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import type { SourceData } from "../data/sources";
import { getSourceTags } from "../data/sources";
import { OPEN_COUNTS_EVENT, readOpenCounts } from "../data/openCounts";

function getHostname(sourceUrl: string) {
	try {
		return new URL(sourceUrl).hostname.replace(/^www\./, "");
	} catch {
		return sourceUrl;
	}
}

/** Small muted chip used for card tags ("+N" included). The chip shrinks and
 *  ellipsizes so a long tag name can never stretch the card, and the "+N"
 *  overflow chip carries a tooltip/aria-label naming the hidden tags. */
function TagChip({ label, tooltip }: { label: string; tooltip?: string }) {
	return (
		<span
			title={tooltip}
			aria-label={tooltip}
			className="inline-flex min-w-0 max-w-full items-center overflow-hidden rounded-full border border-hairline bg-raised/60 px-2 py-0.5 text-[11px] font-medium text-muted"
		>
			<span className="truncate">{label}</span>
		</span>
	);
}

const openControlClass =
	"bg-accent inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition duration-150 hover:opacity-90 active:scale-[0.98]";

const heartButtonClass =
	"inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-muted transition duration-150 hover:border-hairline hover:bg-raised hover:text-ink active:scale-90";

const cardClass =
	"group relative flex h-full min-w-0 flex-col rounded-xl border border-hairline bg-surface p-5 transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md animate-card-in";

/** Hold duration (ms) before a touch press becomes a drag. */
const TOUCH_HOLD_MS = 380;
/** Pointer travel (px) during the hold that cancels it — that is a scroll, not a grab. */
const TOUCH_CANCEL_RADIUS = 10;
/** Window event a dragging card broadcasts so sibling cards can show the insertion ring. */
const TOUCH_DRAG_EVENT = "sf:fav-touch-drag";

type TouchDragDetail = {
	dragging: boolean;
	/** Favorites orderIndex of the hovered card, or null while none is hit. */
	over: number | null;
};

function dispatchTouchDrag(detail: TouchDragDetail) {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new CustomEvent(TOUCH_DRAG_EVENT, { detail }));
}

/** Finger press recorded while the hold timer is pending. */
type TouchHold = { pointerId: number; startX: number; startY: number };

/** Live touch-drag session (one at a time, on the card that was held). */
type TouchDrag = { pointerId: number; originOrder: number; hoverOrder: number | null };

/** Imperative drag guards bound at drag start, removed at drag end/unmount. */
type TouchDragGuards = {
	card: HTMLElement;
	touchMoveGuard: (event: TouchEvent) => void;
	selectGuard: (event: Event) => void;
	escapeGuard: (event: KeyboardEvent) => void;
};

/** Signature "viewfinder" corner brackets that frame the card on hover —
 *  and on keyboard focus, so the response is not pointer-only. */
function ViewfinderCorners() {
	return (
		<span
			aria-hidden
			className="pointer-events-none absolute inset-0 scale-90 opacity-0 transition duration-200 group-focus-within:scale-100 group-focus-within:opacity-100 group-hover:scale-100 group-hover:opacity-100"
		>
			<span className="absolute -left-1.5 -top-1.5 h-4 w-4 rounded-tl-[3px] border-l-2 border-t-2 border-accent" />
			<span className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-tr-[3px] border-r-2 border-t-2 border-accent" />
			<span className="absolute -bottom-1.5 -left-1.5 h-4 w-4 rounded-bl-[3px] border-b-2 border-l-2 border-accent" />
			<span className="absolute -bottom-1.5 -right-1.5 h-4 w-4 rounded-br-[3px] border-b-2 border-r-2 border-accent" />
		</span>
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
			className={`h-[18px] w-[18px] ${filled ? "animate-heart-pop" : ""}`}
			aria-hidden
		>
			<path d="M12 20.5c-.3 0-.6-.1-.8-.3C6.4 16.4 3 13.4 3 9.9 3 7.2 5.1 5 7.8 5c1.6 0 3.1.8 4.2 2.1C13.1 5.8 14.6 5 16.2 5 18.9 5 21 7.2 21 9.9c0 3.5-3.4 6.5-8.2 10.3-.2.2-.5.3-.8.3Z" />
		</svg>
	);
}

/** Decorative drag grip shown on cards while favorites reordering is enabled. */
function GripIcon() {
	return (
		<span aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted/60">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="currentColor"
				stroke="none"
				className="h-full w-full"
				aria-hidden
			>
				<circle cx="9" cy="5" r="1" />
				<circle cx="9" cy="12" r="1" />
				<circle cx="9" cy="19" r="1" />
				<circle cx="15" cy="5" r="1" />
				<circle cx="15" cy="12" r="1" />
				<circle cx="15" cy="19" r="1" />
			</svg>
		</span>
	);
}

export function FrameItem({
	source,
	isFavorite = false,
	onToggleFavorite,
	onOpen,
	reorderEnabled = false,
	orderIndex = -1,
	onReorderFavorite,
	entranceDelay,
}: {
	source: SourceData;
	isFavorite?: boolean;
	onToggleFavorite?: (url: string) => void;
	onOpen?: (url: string, title?: string) => void;
	/** Position of this card in the grid (the parent drives the entrance stagger). */
	index?: number;
	reorderEnabled?: boolean;
	orderIndex?: number;
	onReorderFavorite?: (from: number, to: number) => void;
	entranceDelay?: number;
}) {
	const [dropActive, setDropActive] = useState(false);
	// Touch long-press drag state: `touchLifted` styles the dragged card,
	// `touchTarget` styles the hovered drop target (ring like the HTML5 path).
	const [touchLifted, setTouchLifted] = useState(false);
	const [touchTarget, setTouchTarget] = useState(false);
	// Open counts are read (and subscribed to) right here instead of being
	// passed down, so the FramesList boundary stays untouched.
	const [openCounts, setOpenCounts] = useState<Record<string, number>>({});
	useEffect(() => {
		if (typeof window === "undefined") return;
		setOpenCounts(readOpenCounts());
		const onCounts = () => setOpenCounts(readOpenCounts());
		window.addEventListener(OPEN_COUNTS_EVENT, onCounts as EventListener);
		return () => window.removeEventListener(OPEN_COUNTS_EVENT, onCounts as EventListener);
	}, []);
	const openCount = openCounts[source.URL] ?? 0;
	const hostname = getHostname(source.URL);
	const isLink = source.kind === "link";
	const tags = getSourceTags(source);
	const visibleTags = tags.slice(0, 3);
	const extraTags = tags.length - visibleTags.length;
	const canReorder = reorderEnabled && orderIndex >= 0;

	// Drag/hold bookkeeping lives in refs (no stale closures; every handler
	// reads the latest values), with props mirrored through refs too.
	const cardRef = useRef<HTMLElement | null>(null);
	const holdRef = useRef<TouchHold | null>(null);
	const dragRef = useRef<TouchDrag | null>(null);
	const holdTimerRef = useRef<number | null>(null);
	const hoverRafRef = useRef<number | null>(null);
	const movePointRef = useRef({ x: 0, y: 0 });
	const guardsRef = useRef<TouchDragGuards | null>(null);
	const suppressClickRef = useRef(false);
	const suppressClickTimerRef = useRef<number | null>(null);
	const orderIndexRef = useRef(orderIndex);
	const onReorderFavoriteRef = useRef(onReorderFavorite);
	const canReorderRef = useRef(canReorder);
	orderIndexRef.current = orderIndex;
	onReorderFavoriteRef.current = onReorderFavorite;
	canReorderRef.current = canReorder;

	const clearHoldTimer = () => {
		if (holdTimerRef.current !== null) {
			window.clearTimeout(holdTimerRef.current);
			holdTimerRef.current = null;
		}
	};

	const removeDragGuards = () => {
		const guards = guardsRef.current;
		if (!guards) return;
		guards.card.removeEventListener("touchmove", guards.touchMoveGuard);
		guards.card.removeEventListener("selectstart", guards.selectGuard);
		window.removeEventListener("keydown", guards.escapeGuard);
		guardsRef.current = null;
	};

	const endTouchDrag = (commit: boolean) => {
		const drag = dragRef.current;
		const card = cardRef.current;
		dragRef.current = null;
		if (hoverRafRef.current !== null) {
			window.cancelAnimationFrame(hoverRafRef.current);
			hoverRafRef.current = null;
		}
		removeDragGuards();
		if (drag && card) {
			try {
				card.releasePointerCapture(drag.pointerId);
			} catch {
				/* pointer already gone (or synthetic) */
			}
		}
		setTouchLifted(false);
		dispatchTouchDrag({ dragging: false, over: null });
		if (!drag) return;
		// Any release after drag mode engaged must never also click whatever
		// sits under the finger (Open button/heart): arm the one-shot
		// capture-phase suppress, self-clearing on the next click or shortly
		// after if no click ever arrives.
		suppressClickRef.current = true;
		if (suppressClickTimerRef.current !== null) window.clearTimeout(suppressClickTimerRef.current);
		suppressClickTimerRef.current = window.setTimeout(() => {
			suppressClickRef.current = false;
			suppressClickTimerRef.current = null;
		}, 500);
		if (commit && drag.hoverOrder !== null && drag.hoverOrder !== drag.originOrder) {
			// Same (from, to) semantics as the HTML5 drop handler above, so the
			// persisted favorites order behaves identically for both paths.
			onReorderFavoriteRef.current?.(drag.originOrder, drag.hoverOrder);
		}
	};

	const startTouchDrag = () => {
		const hold = holdRef.current;
		const card = cardRef.current;
		if (!hold || !card) return;
		holdRef.current = null;
		if (!canReorderRef.current) return;
		dragRef.current = {
			pointerId: hold.pointerId,
			originOrder: orderIndexRef.current,
			hoverOrder: null,
		};
		setTouchLifted(true);
		dispatchTouchDrag({ dragging: true, over: null });
		try {
			card.setPointerCapture(hold.pointerId);
		} catch {
			/* synthetic or already-released pointer — bubbling still delivers moves */
		}
		// React registers its root touchmove listener as passive, so the
		// scroll blocker has to be a hand-rolled non-passive listener on the
		// card (touch events keep targeting the element where the touch
		// started, so bubbling reaches it). selectstart is blocked for the
		// same reason: a long-press drag must not select text.
		const guards: TouchDragGuards = {
			card,
			touchMoveGuard: (event) => {
				event.preventDefault();
			},
			selectGuard: (event) => {
				event.preventDefault();
			},
			escapeGuard: (event) => {
				if (event.key !== "Escape") return;
				event.preventDefault();
				endTouchDrag(false);
			},
		};
		card.addEventListener("touchmove", guards.touchMoveGuard, { passive: false });
		card.addEventListener("selectstart", guards.selectGuard);
		window.addEventListener("keydown", guards.escapeGuard);
		guardsRef.current = guards;
	};

	const updateHover = (x: number, y: number) => {
		const drag = dragRef.current;
		const card = cardRef.current;
		if (!drag || !card) return;
		// Candidate cards live in the shared grid container (data-sf-grid is
		// rendered by FramesList); the dragged card itself is never a drop
		// target. Nearest-rect match (distance 0 when the pointer is inside a
		// card) stays robust across rows and columns.
		const grid = card.closest("[data-sf-grid]") ?? card.parentElement;
		if (!grid) return;
		let bestOrder: number | null = null;
		let bestDistance = Number.POSITIVE_INFINITY;
		for (const el of grid.querySelectorAll<HTMLElement>("[data-sf-card]")) {
			if (el === card) continue;
			const rect = el.getBoundingClientRect();
			const dx = Math.max(rect.left - x, 0, x - rect.right);
			const dy = Math.max(rect.top - y, 0, y - rect.bottom);
			const distance = dx * dx + dy * dy;
			if (distance < bestDistance) {
				const order = Number.parseInt(el.dataset.sfCard ?? "", 10);
				if (Number.isInteger(order) && order >= 0) {
					bestDistance = distance;
					bestOrder = order;
				}
			}
		}
		if (bestOrder !== drag.hoverOrder) {
			drag.hoverOrder = bestOrder;
			dispatchTouchDrag({ dragging: true, over: bestOrder });
		}
	};

	// Unmount / re-teardown: kill timers and imperative guards, and free any
	// sibling insertion rings if the card unmounts mid-drag.
	useEffect(
		() => () => {
			clearHoldTimer();
			if (hoverRafRef.current !== null) window.cancelAnimationFrame(hoverRafRef.current);
			if (suppressClickTimerRef.current !== null)
				window.clearTimeout(suppressClickTimerRef.current);
			removeDragGuards();
			if (dragRef.current) dispatchTouchDrag({ dragging: false, over: null });
			dragRef.current = null;
			holdRef.current = null;
		},
		[],
	);

	// Sibling cards listen on the window for the dragged card's broadcasts and
	// light their own insertion ring — keeps drag state out of FramesList.
	useEffect(() => {
		if (!canReorder) return;
		const onTouchDragEvent = (event: Event) => {
			const detail = (event as CustomEvent<TouchDragDetail>).detail;
			setTouchTarget(Boolean(detail?.dragging && detail.over === orderIndexRef.current));
		};
		window.addEventListener(TOUCH_DRAG_EVENT, onTouchDragEvent);
		return () => {
			window.removeEventListener(TOUCH_DRAG_EVENT, onTouchDragEvent);
			setTouchTarget(false);
		};
	}, [canReorder]);

	const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
		if (event.pointerType !== "touch" || !canReorder) return;
		if (!event.isPrimary) {
			// A second finger joins: the gesture is abandoned.
			if (dragRef.current) endTouchDrag(false);
			else {
				clearHoldTimer();
				holdRef.current = null;
			}
			return;
		}
		clearHoldTimer();
		// Record the press and arm the hold timer. No preventDefault here:
		// while the hold is pending the page keeps its native scroll, and any
		// real scroll takeover arrives as pointercancel (handled below).
		holdRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
		holdTimerRef.current = window.setTimeout(() => {
			holdTimerRef.current = null;
			startTouchDrag();
		}, TOUCH_HOLD_MS);
	};

	const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
		const drag = dragRef.current;
		if (drag) {
			if (event.pointerId !== drag.pointerId) return;
			movePointRef.current.x = event.clientX;
			movePointRef.current.y = event.clientY;
			if (hoverRafRef.current === null) {
				hoverRafRef.current = window.requestAnimationFrame(() => {
					hoverRafRef.current = null;
					updateHover(movePointRef.current.x, movePointRef.current.y);
				});
			}
			return;
		}
		const hold = holdRef.current;
		if (holdTimerRef.current === null || !hold || event.pointerId !== hold.pointerId) return;
		const dx = event.clientX - hold.startX;
		const dy = event.clientY - hold.startY;
		if (dx * dx + dy * dy > TOUCH_CANCEL_RADIUS * TOUCH_CANCEL_RADIUS) {
			// Moved too far before the hold fired — that is a scroll, not a grab.
			clearHoldTimer();
			holdRef.current = null;
		}
	};

	const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
		const drag = dragRef.current;
		if (drag) {
			if (event.pointerId !== drag.pointerId) return;
			endTouchDrag(true);
			return;
		}
		const hold = holdRef.current;
		if (hold && event.pointerId === hold.pointerId) {
			// Released before the hold fired (tap / tap-and-hold in place):
			// no drag ever engaged, no side effects — a native click proceeds.
			clearHoldTimer();
			holdRef.current = null;
		}
	};

	const onPointerCancel = (event: ReactPointerEvent<HTMLElement>) => {
		const drag = dragRef.current;
		if (drag) {
			if (event.pointerId !== drag.pointerId) return;
			endTouchDrag(false);
			return;
		}
		const hold = holdRef.current;
		if (hold && event.pointerId === hold.pointerId) {
			clearHoldTimer();
			holdRef.current = null;
		}
	};

	const onLostPointerCapture = (event: ReactPointerEvent<HTMLElement>) => {
		// Safety net: the browser took the pointer back mid-drag — abort quietly.
		const drag = dragRef.current;
		if (drag && event.pointerId === drag.pointerId) endTouchDrag(false);
	};

	const onContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
		// A long-press would normally open the platform menu mid-hold/mid-drag.
		if (dragRef.current || holdTimerRef.current !== null) event.preventDefault();
	};

	const onClickCapture = (event: ReactMouseEvent<HTMLElement>) => {
		if (!suppressClickRef.current) return;
		// One-shot: a touch drag just ended over this card — swallow the
		// release click (and any navigation) so Open/heart don't fire from it.
		suppressClickRef.current = false;
		if (suppressClickTimerRef.current !== null) {
			window.clearTimeout(suppressClickTimerRef.current);
			suppressClickTimerRef.current = null;
		}
		event.preventDefault();
		event.stopPropagation();
	};

	return (
		<article
			ref={cardRef}
			draggable={reorderEnabled}
			data-sf-card={orderIndex}
			data-sf-touch-dragging={touchLifted ? "true" : undefined}
			data-sf-drop-target={touchTarget ? "true" : undefined}
			onDragStart={(e) => {
				if (!reorderEnabled) return;
				e.dataTransfer.setData("text/sf-fav-index", String(orderIndex));
				e.dataTransfer.effectAllowed = "move";
			}}
			onDragOver={(e) => {
				if (!canReorder) return;
				e.preventDefault();
				e.dataTransfer.dropEffect = "move";
				setDropActive(true);
			}}
			onDragLeave={() => setDropActive(false)}
			onDrop={(e) => {
				e.preventDefault();
				setDropActive(false);
				const draggedIndex = Number.parseInt(e.dataTransfer.getData("text/sf-fav-index"), 10);
				if (Number.isNaN(draggedIndex) || draggedIndex < 0 || draggedIndex === orderIndex) return;
				onReorderFavorite?.(draggedIndex, orderIndex);
			}}
			onDragEnd={() => setDropActive(false)}
			onKeyDown={(e) => {
				if (!canReorder || !e.altKey) return;
				if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
				e.preventDefault();
				onReorderFavorite?.(orderIndex, orderIndex + (e.key === "ArrowUp" ? -1 : 1));
			}}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerCancel}
			onLostPointerCapture={onLostPointerCapture}
			onContextMenu={onContextMenu}
			onClickCapture={onClickCapture}
			style={entranceDelay === undefined ? undefined : { animationDelay: `${entranceDelay}ms` }}
			className={`${cardClass} ${reorderEnabled ? "cursor-grab active:cursor-grabbing" : ""} ${
				dropActive ? "ring-2 ring-accent/50" : ""
			} ${touchLifted ? "z-10 scale-[1.02] shadow-lg ring-2 ring-accent/60" : ""} ${
				touchTarget ? "ring-2 ring-accent/50" : ""
			}`}
		>
			<ViewfinderCorners />

			<div className="flex-1">
				<div className="flex flex-wrap gap-1.5">
					{visibleTags.map((tag) => (
						<TagChip key={tag} label={tag} />
					))}
					{extraTags > 0 ? (
						<TagChip
							label={`+${extraTags}`}
							tooltip={`Also: ${tags.slice(visibleTags.length).join(", ")}`}
						/>
					) : null}
				</div>

				{/* Native tooltip on the title when a description exists (custom
					frames may have none; empty strings never pass the guard). */}
				<h2
					title={source.description || undefined}
					className="mt-1.5 font-display text-lg font-semibold leading-snug text-ink"
				>
					{source.name}
				</h2>

				{source.description ? (
					<p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{source.description}</p>
				) : null}
			</div>

			<div className="mt-5 flex items-center justify-between gap-3 border-t border-hairline pt-4">
				<div className="flex min-w-0 items-center gap-1.5">
					{reorderEnabled ? <GripIcon /> : null}
					<span className="min-w-0 truncate text-xs text-muted">{hostname}</span>
					{openCount >= 2 ? (
						<span
							title={`Opened ${openCount} times`}
							className="shrink-0 text-[10px] text-muted tabular-nums"
						>
							{openCount}×
						</span>
					) : null}
				</div>

				<div className="flex shrink-0 items-center gap-2">
					<button
						type="button"
						aria-pressed={isFavorite}
						aria-label={
							isFavorite
								? `Remove ${source.name} from favorites`
								: `Add ${source.name} to favorites`
						}
						onClick={() => onToggleFavorite?.(source.URL)}
						className={`${heartButtonClass} ${isFavorite ? "text-red-500 hover:text-red-500" : ""}`}
					>
						<HeartIcon filled={isFavorite} />
					</button>

					{isLink ? (
						<a
							href={source.URL}
							target="_blank"
							rel="noopener noreferrer"
							className={openControlClass}
						>
							Open
							{/* ↗ marks the one kind that leaves the app for a new tab. */}
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
								<path d="M7 17 17 7M9 7h8v8" />
							</svg>
						</a>
					) : (
						<button
							type="button"
							onClick={() => onOpen?.(source.URL, source.name)}
							className={openControlClass}
						>
							Open
						</button>
					)}
				</div>
			</div>
		</article>
	);
}

export default FrameItem;
