import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusTrap } from "../useFocusTrap";
import { showToast } from "../Toast";
import { openDirectTab, popOutFrame } from "../utils/aboutBlank";
import { isEmbeddableUrl } from "../utils/urlGuard";

type FrameContentProps = {
	url: string;
	onClose?: () => void;
	title?: string;
};

const iconButtonClass =
	"inline-flex h-9 w-9 items-center justify-center rounded-md text-muted transition duration-150 hover:bg-raised hover:text-ink active:scale-90";

/* Older Safari only ships the webkit-prefixed fullscreen API. */
type FullscreenDocument = Document & {
	webkitFullscreenElement?: Element | null;
	webkitExitFullscreen?: () => void;
};

type FullscreenElement = HTMLElement & {
	webkitRequestFullscreen?: () => void;
};

const getFullscreenElement = (): Element | null => {
	const doc = document as FullscreenDocument;
	return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
};

/**
 * Sandboxed frame viewer with a source-only fullscreen mode: fullscreening
 * the frame area itself leaves the toolbar (and the rest of the app) out of
 * the picture, so the source owns the whole screen. Escape closes (via onClose, else
 * history.back()) — but never while the browser is fullscreen, where Escape
 * belongs to the browser first. Body scroll is locked while open; a focus
 * trap keeps keyboard focus inside the dialog — Tab cycles and wraps the
 * toolbar buttons (the iframe is not Tab-reachable, by browser default) and
 * initial focus lands on the close button. Closing plays the overlay-out
 * animation before the overlay unmounts, then the trap restores focus to
 * the trigger that opened the viewer.
 */
export default function FrameContent({ url, onClose, title }: FrameContentProps) {
	const closeRef = useRef<HTMLButtonElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	// The frame area (iframe + hint pills + loading backdrop) — the element
	// that goes fullscreen so only the source fills the screen.
	const contentRef = useRef<HTMLDivElement>(null);
	const isClosingRef = useRef(false);
	// The close safety timer must be cancellable: onAnimationEnd also calls
	// onClose, and without cancelling, the timer would fire a second onClose
	// 260ms later (a double history.back() for the no-onClose callers).
	const closeTimerRef = useRef<number | null>(null);
	const [isClosing, setIsClosing] = useState(false);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const [reloadKey, setReloadKey] = useState(0);
	const [slowHint, setSlowHint] = useState(false);
	const [hintDismissed, setHintDismissed] = useState(false);
	// One-shot hint for the iframe-focus dead end: once the frame itself
	// is focused (a click into it), Escape can no longer reach the parent
	// window — a focused cross-origin iframe keeps the key. The pill
	// reminds the user that the toolbar above stays available. It shows
	// at most once per iframe load (a reload re-arms it), auto-dismisses
	// after 3.5s, and toolbar focus dismisses it early.
	const [iframeHintVisible, setIframeHintVisible] = useState(false);
	const [iframeHintLeaving, setIframeHintLeaving] = useState(false);
	const iframeHintShownRef = useRef(false);
	const iframeHintTimerRef = useRef<number | null>(null);

	/** Every close trigger (toolbar button, Escape) funnels through the exit animation. */
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
			if (onClose) onClose();
			else window.history.back();
		}, 260);
	}, [onClose]);

	/**
	 * Escape closes, shared by the focus trap (container keydown) and the
	 * window listener below. In fullscreen the first Escape belongs to the
	 * browser (it exits fullscreen); only close once no fullscreen element
	 * remains. The trap never stops or prevents the event, so one physical
	 * Escape runs both handlers — beginClose's ref guard makes the second
	 * call a no-op.
	 */
	const handleEscape = useCallback(() => {
		if (getFullscreenElement()) return;
		beginClose();
	}, [beginClose]);

	/**
	 * Focus trap for the dialog. FrameContent is only mounted while a frame
	 * is open (FramesList renders it conditionally), so the trap is armed for
	 * its whole lifetime and `active` is constant true. Declared before the
	 * effects below so the restore target is captured while the outside
	 * trigger (the Open / recent-frames button) still holds focus. The hook
	 * owns initial focus — the close button, one rAF after mount — replacing
	 * the old manual focus effect: without the explicit getter the hook's
	 * default would land on the first toolbar button (pop-out), not close.
	 * onEscape is the fullscreen-guarded handleEscape rather than bare
	 * beginClose: the trap's container keydown fires before the window
	 * listener, so an unguarded close here would beat the browser's own
	 * Escape-to-exit-fullscreen. Tab cycles and wraps the toolbar buttons;
	 * the iframe is not Tab-reachable (browser default), which is the
	 * desired containment.
	 */
	useFocusTrap(true, containerRef, {
		initialFocus: () => closeRef.current,
		onEscape: handleEscape,
	});

	useEffect(() => {
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		// Initial focus (the close button) is owned by useFocusTrap above.
		return () => {
			document.body.style.overflow = prevOverflow;
		};
	}, []);

	// The window listener stays as the outer safety net: the trap's
	// container-level keydown never sees events that start outside the dialog
	// (or inside a focused iframe). Both paths funnel into handleEscape.
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			handleEscape();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [handleEscape]);

	useEffect(() => {
		const sync = () => setIsFullscreen(Boolean(getFullscreenElement()));
		sync();
		document.addEventListener("fullscreenchange", sync);
		document.addEventListener("webkitfullscreenchange", sync);
		return () => {
			document.removeEventListener("fullscreenchange", sync);
			document.removeEventListener("webkitfullscreenchange", sync);
		};
	}, []);

	// Reset load tracking whenever the frame (re)mounts. If nothing has
	// loaded after 4s, offer the pop-out — some sites refuse embedding.
	useEffect(() => {
		setLoaded(false);
		setSlowHint(false);
		setHintDismissed(false);
		// The iframe-focus hint is once per LOAD: a reload remounts the
		// iframe, so drop any pending cycle and re-arm the pill.
		if (iframeHintTimerRef.current !== null) {
			window.clearTimeout(iframeHintTimerRef.current);
			iframeHintTimerRef.current = null;
		}
		iframeHintShownRef.current = false;
		setIframeHintVisible(false);
		setIframeHintLeaving(false);
		const slow = window.setTimeout(() => setSlowHint(true), 4000);
		return () => window.clearTimeout(slow);
	}, [url, reloadKey]);

	// Pending hint timers must not fire into an unmounted viewer.
	useEffect(
		() => () => {
			if (iframeHintTimerRef.current !== null) window.clearTimeout(iframeHintTimerRef.current);
		},
		[],
	);

	// Same for the close safety timer.
	useEffect(
		() => () => {
			if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
		},
		[],
	);

	const toggleFullscreen = () => {
		// Fullscreen the frame area, not the dialog chrome: the toolbar stays
		// behind with the rest of the app and the source fills the screen.
		// Escape belongs to the browser first (it exits fullscreen), and only
		// closes the viewer on the next press — see the keydown guard above.
		const content = contentRef.current;
		if (!content) return;
		if (getFullscreenElement()) {
			if (document.exitFullscreen) document.exitFullscreen();
			else (document as FullscreenDocument).webkitExitFullscreen?.();
		} else if (content.requestFullscreen) {
			content.requestFullscreen();
		} else {
			(content as FullscreenElement).webkitRequestFullscreen?.();
		}
	};

	const handlePopOut = () => {
		// Navbar "Open in new tab": one guarded helper owns every pop-out —
		// cloaked shell first (opened synchronously inside the click gesture
		// so popup blockers don't swallow it), plain new-tab fallback if the
		// popup was still blocked, and a rejection (false) when the URL fails
		// the embeddability bar (stale storage data, own-origin URL).
		if (!popOutFrame(url, title)) {
			showToast("That URL can't be opened in a new tab (http(s) URLs only).", "error");
		}
	};

	const handleHintPopOut = () => {
		// The slow-embed pill's "Pop it out" suggestion is a direct handoff:
		// open a new tab at the source URL itself, no cloak in between — but
		// still through the same embeddability bar as every other pop-out.
		if (!openDirectTab(url)) {
			showToast("That URL can't be opened in a new tab (http(s) URLs only).", "error");
		}
	};

	const reloadFrame = () => setReloadKey((k) => k + 1);

	/** Unmount the pill, cancelling any pending auto-dismiss/exit timer. */
	const hideIframeHintNow = () => {
		if (iframeHintTimerRef.current !== null) {
			window.clearTimeout(iframeHintTimerRef.current);
			iframeHintTimerRef.current = null;
		}
		setIframeHintVisible(false);
		setIframeHintLeaving(false);
	};

	/**
	 * Start the toast-out exit; the pill's own animationend (or the safety
	 * timer) unmounts it. Refs + setState only, so scheduling this from a
	 * timer never sees stale state.
	 */
	const startIframeHintExit = () => {
		if (iframeHintTimerRef.current !== null) window.clearTimeout(iframeHintTimerRef.current);
		setIframeHintLeaving(true);
		iframeHintTimerRef.current = window.setTimeout(hideIframeHintNow, 260);
	};

	/** First iframe focus of a load shows the pill; later ones are no-ops. */
	const showIframeHint = () => {
		if (iframeHintShownRef.current) return;
		iframeHintShownRef.current = true;
		setIframeHintVisible(true);
		iframeHintTimerRef.current = window.setTimeout(startIframeHintExit, 3500);
	};

	/** Toolbar focus dismisses the pill early (fresh closure: fresh state). */
	const dismissIframeHint = () => {
		if (!iframeHintVisible || iframeHintLeaving) return;
		startIframeHintExit();
	};

	if (!url) return null;

	// Sink-side bar: every read path (custom frames, recents, built-ins) is
	// validated upstream, but this component's output IS the navigation — so
	// it re-checks before anything becomes a frame or a pop-out. A URL that
	// fails the bar (non-http(s), or this app's own origin) renders the
	// blocked panel instead of the iframe.
	const embeddable = isEmbeddableUrl(url);
	const canPopOut = embeddable;
	// iPhone Safari exposes no element-fullscreen API — the button would
	// silently do nothing there, so it is hidden instead of dead.
	const fullscreenSupported =
		typeof document !== "undefined" &&
		(document.fullscreenEnabled === true ||
			Boolean((document.documentElement as FullscreenElement).webkitRequestFullscreen));
	const fullscreenLabel = isFullscreen ? "Exit fullscreen" : "Enter fullscreen";
	// Subtle attention pull toward the close button while the hint pill
	// shows: a plain ring toggled by class — the shared iconButtonClass
	// transition animates the box-shadow, no new keyframes.
	const iframeHintRing = iframeHintVisible && !iframeHintLeaving;

	return (
		<div
			ref={containerRef}
			role="dialog"
			aria-modal="true"
			aria-label={title ?? "Frame viewer"}
			className={`${isClosing ? "animate-overlay-out" : "animate-overlay-in"} fixed inset-0 z-[9999] flex flex-col bg-black/80`}
			onAnimationEnd={(e) => {
				// Only react to the root's own overlay-out run, never to child
				// animation events bubbling up.
				if (!isClosing || e.target !== e.currentTarget) return;
				if (closeTimerRef.current !== null) {
					window.clearTimeout(closeTimerRef.current);
					closeTimerRef.current = null;
				}
				isClosingRef.current = false;
				if (onClose) onClose();
				else window.history.back();
			}}
		>
			<div
				className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-hairline bg-page/85 px-3 backdrop-blur-md"
				// React onFocus is focusin: any toolbar button gaining focus
				// (click, trap cycling, initial focus) dismisses the hint early.
				onFocus={dismissIframeHint}
			>
				<span className="min-w-0 truncate text-sm font-medium text-ink">{title ?? url}</span>

				<div className="flex shrink-0 items-center gap-1.5">
					{canPopOut ? (
						<button
							type="button"
							aria-label="Open in new tab"
							title="Open in new tab"
							onClick={handlePopOut}
							className={iconButtonClass}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth={1.8}
								strokeLinecap="round"
								strokeLinejoin="round"
								className="h-[18px] w-[18px]"
								aria-hidden
							>
								<path d="M14 4h6v6M20 4 10 14M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
							</svg>
						</button>
					) : null}
					{fullscreenSupported ? (
						<button
							type="button"
							aria-label={fullscreenLabel}
							title={fullscreenLabel}
							onClick={toggleFullscreen}
							className={iconButtonClass}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth={1.8}
								strokeLinecap="round"
								strokeLinejoin="round"
								className="h-[18px] w-[18px]"
								aria-hidden
							>
								{isFullscreen ? (
									<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
								) : (
									<path d="M8 3H5a2 2 0 0 0-2 2v3m13 0V5a2 2 0 0 0-2-2h-3m3 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
								)}
							</svg>
						</button>
					) : null}
					<button
						type="button"
						aria-label="Reload frame"
						title="Reload frame"
						onClick={reloadFrame}
						className={iconButtonClass}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth={1.8}
							strokeLinecap="round"
							strokeLinejoin="round"
							className="h-[18px] w-[18px]"
							aria-hidden
						>
							<path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
						</svg>
					</button>
					<span aria-hidden className="h-5 w-px bg-hairline" />
					<button
						type="button"
						ref={closeRef}
						aria-label="Close frame"
						title="Close (Esc)"
						onClick={beginClose}
						className={
							iframeHintRing ? `${iconButtonClass} ring-2 ring-accent/40` : iconButtonClass
						}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth={1.8}
							strokeLinecap="round"
							strokeLinejoin="round"
							className="h-[18px] w-[18px]"
							aria-hidden
						>
							<path d="M6 6l12 12M18 6 6 18" />
						</svg>
					</button>
				</div>
			</div>

			<div ref={contentRef} className="relative min-h-0 flex-1">
				{iframeHintVisible && !isFullscreen ? (
					<p
						role="status"
						onAnimationEnd={(e) => {
							// Only the pill's own toast-out run unmounts it; the
							// toast-in entrance run must be ignored.
							if (!iframeHintLeaving || e.target !== e.currentTarget) return;
							hideIframeHintNow();
						}}
						className={`${
							iframeHintLeaving ? "animate-toast-out" : "animate-toast-in"
						} pointer-events-none absolute right-3 top-3 z-20 max-w-[calc(100%-1.5rem)] rounded-full border border-hairline bg-surface/95 px-3 py-1.5 text-xs text-muted shadow-lg backdrop-blur`}
					>
						Tip: the toolbar above stays available
					</p>
				) : null}
				{/* The bg-page backdrop stays mounted until onLoad so the
                                    iframe's white background never flashes through; once the
                                    4s slow-embed hint appears it owns the message (the ring
                                    and caption yield to it) and after a dismissal the
                                    spinner stays gone — only a reload brings it back. */}
				{embeddable && !loaded ? (
					<div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-page">
						{!slowHint ? (
							<>
								<span className="h-8 w-8 animate-spin rounded-full border-2 border-hairline border-t-accent" />
								<span className="text-xs text-muted">Loading frame…</span>
							</>
						) : null}
					</div>
				) : null}
				{slowHint && !hintDismissed && embeddable ? (
					<div className="animate-fade-in absolute bottom-4 left-1/2 z-20 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2.5 rounded-full border border-hairline bg-surface px-4 py-2 shadow-lg">
						<span className="text-xs text-muted">
							Still loading? Some sites refuse to be embedded.
						</span>
						{canPopOut ? (
							<button
								type="button"
								onClick={handleHintPopOut}
								className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-white transition duration-150 hover:opacity-90 active:scale-[0.98]"
							>
								Pop it out
							</button>
						) : null}
						<button
							type="button"
							aria-label="Dismiss"
							title="Dismiss"
							onClick={() => setHintDismissed(true)}
							className="shrink-0 text-muted transition duration-150 hover:text-ink"
						>
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
								<path d="M18 6 6 18M6 6l12 12" />
							</svg>
						</button>
					</div>
				) : null}
				{embeddable ? (
					<iframe
						key={reloadKey}
						src={url}
						title={title ?? url}
						onLoad={() => {
							setLoaded(true);
							setSlowHint(false);
						}}
						// The parent document fires focus on the iframe element
						// itself when the frame gains focus (React onFocus is the
						// bubbling focusin) — the one moment Escape stops working.
						onFocus={showIframeHint}
						className="h-full w-full border-0 bg-white"
						sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
						allow="fullscreen"
						allowFullScreen
					/>
				) : (
					<div
						role="alert"
						className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-page px-6 text-center"
					>
						<span className="text-sm font-medium text-ink">This frame cannot be displayed</span>
						<span className="max-w-sm text-xs text-muted">
							Only http(s) URLs from other sites can be embedded here. Edit or remove the frame in
							Settings to continue.
						</span>
					</div>
				)}
			</div>
		</div>
	);
}
