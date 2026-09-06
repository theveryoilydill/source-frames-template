import { useEffect, useRef, type RefObject } from "react";

/**
 * Selector for elements that can receive keyboard focus inside a trapped
 * container. `[tabindex]` also matches programmatic-focus containers, and
 * `input` is listed without a disabled guard, so isFocusableVisible filters
 * the inert matches out again (see below).
 */
const FOCUSABLE_SELECTOR =
	'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * Whether a focusable element is actually reachable by keyboard focus right
 * now. `offsetParent` is null for anything not being rendered - display:none
 * and closed <details> subtrees included - which makes it the cheap primary
 * guard for closed/hidden subtrees. The geometry fallback keeps focusables
 * inside the app's position:fixed dialog overlays from being dropped (a
 * fixed element's own offsetParent is null by spec), and the visibility
 * check rejects visibility:hidden boxes that still own layout.
 */
function isFocusableVisible(element: HTMLElement): boolean {
	if (element.matches(":disabled")) return false;
	if (element.offsetParent !== null) {
		return getComputedStyle(element).visibility !== "hidden";
	}
	return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
	return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
		isFocusableVisible,
	);
}

/**
 * Shared focus trap for the app's modal overlays (frame viewer, import
 * dialog, shortcuts dialog, command palette). It slots into - never
 * replaces - the existing dialog pattern: dialogs keep their own close
 * funnel (an idempotent `beginClose` guarded by a ref) and may keep their
 * own initial-focus effect; this hook adds focus capture, Tab cycling and
 * Escape signalling around them.
 *
 * Example:
 *
 *     const containerRef = useRef<HTMLDivElement>(null);
 *     const closeRef = useRef<HTMLButtonElement>(null);
 *     useFocusTrap(isOpen, containerRef, {
 *         initialFocus: () => closeRef.current,
 *         onEscape: beginClose,
 *     });
 *
 *     return <div ref={containerRef} role="dialog" aria-modal="true">...</div>;
 *
 * Activation (active: false -> true):
 *
 * - The currently focused element is captured for later restore (only if it
 *   is an HTMLElement). This happens synchronously in the effect, so a
 *   caller that focuses its own initial element from a mount effect should
 *   declare useFocusTrap BEFORE that effect to capture the outside trigger.
 * - One animation frame later the trap focuses
 *   `options.initialFocus?.() ?? first focusable inside the container`. The
 *   frame deferral is deliberate: the dialogs focus their initial element
 *   from their own mount effects, so an immediate focus here would race
 *   them and fight their choice; the frame is cancelled if `active` flips
 *   back before it fires.
 * - The default (no `initialFocus`) step is skipped when focus is ALREADY
 *   inside the container - a dialog that focused its own close button or
 *   first checkbox keeps that focus instead of being stomped by "first
 *   focusable". An explicit `initialFocus` is always applied, with a null
 *   result falling back to the first focusable.
 *
 * While active:
 *
 * - A keydown listener lives ON THE CONTAINER, not on window. Key events
 *   dispatched to the page or into an iframe never pass through the
 *   container, so the trap cannot steal keys from anything it does not own
 *   while inactive; the flip side (accepted here) is that keys typed inside
 *   a focused iframe are same-document and cannot be trapped either.
 * - Tab / Shift+Tab cycle among visible focusables (FOCUSABLE_SELECTOR
 *   filtered by isFocusableVisible) and wrap at both ends. If focus sits on
 *   a non-focusable (e.g. a tabIndex={-1} heading), Tab moves to the first
 *   and Shift+Tab to the last; with no focusables at all, Tab is simply
 *   prevented so focus cannot escape the container.
 * - Escape calls `options.onEscape` ONLY - no preventDefault, no
 *   stopPropagation. The dialogs also listen for Escape on window (see
 *   FrameContent.tsx, ImportDialog.tsx, ShortcutsDialog.tsx), so one
 *   physical Escape fires both this hook's container listener and the
 *   dialog's window listener. That is intentional and safe: every close
 *   path funnels through the same ref-guarded `beginClose`, so the second
 *   call is a no-op, and leaving the event untouched is exactly what lets
 *   the window listener still see it.
 *
 * Deactivation (active: true -> false, or unmount):
 *
 * - All listeners are removed and any pending focus frame is cancelled.
 * - Focus is restored to the captured element when `restoreFocus !== false` (skipped when focus already moved outside the container - a focus handoff, e.g. a viewer opened from a closing command palette)
 *   and that element is still connected; a no-op if it is already focused.
 *
 * SSR-safe: nothing touches window or document outside this effect, and a
 * null container no-ops cleanly (restore bookkeeping stays symmetric).
 * `options` is read through a ref, so passing an inline options object does
 * not re-arm the trap - only an `active` transition does.
 */
export function useFocusTrap(
	active: boolean,
	containerRef: RefObject<HTMLElement | null>,
	options?: {
		initialFocus?: () => HTMLElement | null;
		restoreFocus?: boolean;
		onEscape?: () => void;
	},
): void {
	const optionsRef = useRef(options);
	// Latest-ref pattern: callers pass inline option objects, so the trap is
	// (re)armed only by an `active` transition, never by a re-render.
	optionsRef.current = options;

	useEffect(() => {
		if (!active) return;

		const container = containerRef.current;
		const previouslyFocused =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		let focusFrame = 0;

		const restore = () => {
			if (optionsRef.current?.restoreFocus === false) return;
			if (!previouslyFocused || !previouslyFocused.isConnected) return;
			if (document.activeElement === previouslyFocused) return;
			// Focus handoff: when focus has already moved to a live element
			// outside this container (e.g. a viewer opened from a closing
			// command palette), leave it alone instead of yanking it back to
			// the trigger the trap captured at activation.
			const current = document.activeElement;
			if (
				current instanceof HTMLElement &&
				current.isConnected &&
				current !== document.body &&
				container &&
				!container.contains(current)
			)
				return;
			previouslyFocused.focus();
		};

		if (!container) {
			// Armed without a container: nothing to listen on or focus - no-op
			// cleanly, but keep restore symmetric on deactivation.
			return restore;
		}

		const focusInitial = () => {
			const explicit = optionsRef.current?.initialFocus;
			if (explicit) {
				// Explicit target wins; a nullish result falls back to the
				// first focusable, mirroring `initialFocus?.() ?? first`.
				const target = explicit() ?? getFocusableElements(container)[0];
				target?.focus();
				return;
			}
			// Default target: first focusable - unless the dialog already
			// moved focus inside itself from its own mount effect, which the
			// trap must not fight.
			if (container.contains(document.activeElement)) return;
			getFocusableElements(container)[0]?.focus();
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				// Pass-through: the dialog's own window keydown listener fires
				// for this same event and runs its (idempotent) beginClose;
				// see the class-level JSDoc for why we do not interfere.
				optionsRef.current?.onEscape?.();
				return;
			}
			if (event.key !== "Tab") return;
			// Browser-level Tab shortcuts (Alt/Ctrl/Mod+Tab) are none of our
			// business; Shift is meaningful and kept.
			if (event.altKey || event.ctrlKey || event.metaKey) return;

			const focusable = getFocusableElements(container);
			if (focusable.length === 0) {
				// Nowhere to cycle: at least keep focus from leaving.
				event.preventDefault();
				return;
			}
			const currentIndex =
				document.activeElement instanceof HTMLElement
					? focusable.indexOf(document.activeElement)
					: -1;
			event.preventDefault();
			let next: HTMLElement;
			if (event.shiftKey) {
				next = currentIndex <= 0 ? focusable[focusable.length - 1] : focusable[currentIndex - 1];
			} else {
				next =
					currentIndex === -1 || currentIndex === focusable.length - 1
						? focusable[0]
						: focusable[currentIndex + 1];
			}
			next.focus();
		};

		// Deferred + cancellable so the dialogs' own mount-effect focus wins
		// the race; see focusInitial for the exact resolution order.
		focusFrame = window.requestAnimationFrame(() => {
			focusFrame = 0;
			focusInitial();
		});
		container.addEventListener("keydown", handleKeyDown);

		return () => {
			if (focusFrame !== 0) window.cancelAnimationFrame(focusFrame);
			container.removeEventListener("keydown", handleKeyDown);
			restore();
		};
	}, [active, containerRef]);
}
