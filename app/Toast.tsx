import { useCallback, useEffect, useRef, useState } from "react";

export type ToastKind = "success" | "error" | "info";

/**
 * Optional action button rendered between the message and the close
 * button: clicking it runs onClick and dismisses the toast immediately.
 */
export type ToastAction = { label: string; onClick: () => void };

export const TOAST_EVENT = "sf:toast";
export const TOAST_LIMIT = 4;
export const TOAST_DURATION = 3800;
export const TOAST_EXIT_MS = 240;

/**
 * Payload carried by the "sf:toast" CustomEvent detail: showToast() builds
 * and dispatches it, <ToastRegion> consumes it. `action` is optional; when
 * present and valid it renders as a small button next to the message.
 */
export type ToastPayload = {
	id: string;
	message: string;
	kind: ToastKind;
	createdAt: number;
	action?: ToastAction;
};

type ToastItem = ToastPayload & { exiting: boolean };

const dismissButtonClass =
	"inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition duration-150 hover:bg-raised hover:text-ink active:scale-90";

const kindIconClass: Record<ToastKind, string> = {
	success: "text-accent",
	error: "text-red-600 dark:text-red-500",
	info: "text-muted",
};

const createToastId = () => {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}
	return `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

/**
 * Fires a "sf:toast" window CustomEvent (same pattern as the data modules'
 * sync events). SSR-safe no-op; <ToastRegion> mounted in root.tsx renders.
 * `action`, when provided, renders as a small button next to the message;
 * clicking it runs onClick and dismisses the toast immediately.
 */
export function showToast(message: string, kind: ToastKind = "info", action?: ToastAction): void {
	if (typeof window === "undefined") return;
	const detail: ToastPayload = {
		id: createToastId(),
		message,
		kind,
		createdAt: Date.now(),
	};
	if (action) detail.action = action;
	window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail }));
}

/** Leading kind icon — check-circle / alert-circle / info circle. */
function KindIcon({ kind }: { kind: ToastKind }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={`h-4 w-4 shrink-0 ${kindIconClass[kind]}`}
			aria-hidden
		>
			<circle cx="12" cy="12" r="10" />
			{kind === "success" ? (
				<path d="m9 12 2 2 4-4" />
			) : kind === "error" ? (
				<>
					<path d="M12 8v4" />
					<path d="M12 16h.01" />
				</>
			) : (
				<>
					<path d="M12 16v-4" />
					<path d="M12 8h.01" />
				</>
			)}
		</svg>
	);
}

/**
 * Transient notification stack (bottom center on mobile, bottom right on
 * sm+). Listens for the "sf:toast" CustomEvent, keeps at most TOAST_LIMIT
 * toasts (oldest dropped), and auto-dismisses each after TOAST_DURATION.
 * Every dismissal funnels through animate-toast-out before the toast
 * unmounts, with a safety timer like TagsMenu/FrameContent because
 * background tabs throttle CSS animations and animationend may never fire.
 *
 * SSR-safe: nothing touches window during render — the listener lives in a
 * useEffect and all listeners/timeouts are cleaned up on unmount. The
 * container is role="status" aria-live="polite" so screen readers announce
 * new toasts; toasts are transient, only the dismiss and action buttons are
 * focusable.
 */
export function ToastRegion() {
	const [toasts, setToasts] = useState<ToastItem[]>([]);
	const exitingRef = useRef<Set<string>>(new Set());
	const autoTimersRef = useRef<Map<string, number>>(new Map());
	const pendingTimersRef = useRef<Set<number>>(new Set());

	/** setTimeout that remembers its id so unmount can clear everything. */
	const schedule = useCallback((fn: () => void, ms: number) => {
		const id = window.setTimeout(() => {
			pendingTimersRef.current.delete(id);
			fn();
		}, ms);
		pendingTimersRef.current.add(id);
		return id;
	}, []);

	const removeToast = useCallback((id: string) => {
		exitingRef.current.delete(id);
		setToasts((list) => list.filter((toast) => toast.id !== id));
	}, []);

	/** Every dismissal (auto, the X button, or a toast action) funnels through the exit animation. */
	const beginExit = useCallback(
		(id: string) => {
			if (exitingRef.current.has(id)) return;
			exitingRef.current.add(id);
			const auto = autoTimersRef.current.get(id);
			if (auto !== undefined) {
				window.clearTimeout(auto);
				pendingTimersRef.current.delete(auto);
				autoTimersRef.current.delete(id);
			}
			setToasts((list) =>
				list.map((toast) => (toast.id === id ? { ...toast, exiting: true } : toast)),
			);
			// Safety net: background tabs throttle CSS animations, so
			// animationend may never fire — unmount anyway.
			schedule(() => removeToast(id), TOAST_EXIT_MS);
		},
		[removeToast, schedule],
	);

	useEffect(() => {
		const onToast = (e: Event) => {
			const detail = (e as CustomEvent<ToastPayload>).detail;
			if (!detail || typeof detail.message !== "string" || detail.message.length === 0) return;
			const toast: ToastItem = {
				id: typeof detail.id === "string" && detail.id ? detail.id : createToastId(),
				message: detail.message,
				kind: detail.kind === "success" || detail.kind === "error" ? detail.kind : "info",
				createdAt: typeof detail.createdAt === "number" ? detail.createdAt : Date.now(),
				exiting: false,
			};
			// Defensive: an action without a usable label or handler never
			// reaches the DOM (renders as if it were not provided).
			const rawAction = detail.action;
			if (
				rawAction &&
				typeof rawAction.label === "string" &&
				rawAction.label.length > 0 &&
				typeof rawAction.onClick === "function"
			) {
				toast.action = { label: rawAction.label, onClick: rawAction.onClick };
			}
			setToasts((list) => [...list, toast].slice(-TOAST_LIMIT));
			const autoId = schedule(() => beginExit(toast.id), TOAST_DURATION);
			autoTimersRef.current.set(toast.id, autoId);
		};
		window.addEventListener(TOAST_EVENT, onToast);
		return () => {
			window.removeEventListener(TOAST_EVENT, onToast);
			for (const id of pendingTimersRef.current) window.clearTimeout(id);
			pendingTimersRef.current.clear();
			autoTimersRef.current.clear();
		};
	}, [beginExit, schedule]);

	return (
		<div
			role="status"
			aria-live="polite"
			className="pointer-events-none fixed bottom-4 inset-x-4 z-[60] flex flex-col gap-2 sm:left-auto sm:right-6"
		>
			{toasts.map((toast) => (
				<div
					key={toast.id}
					className={`${
						toast.exiting ? "animate-toast-out" : "animate-toast-in"
					} pointer-events-auto flex items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-3 text-sm shadow-lg`}
					onAnimationEnd={(e) => {
						// Only the toast's own toast-out run removes it; the entrance
						// run must be ignored.
						if (!toast.exiting || e.target !== e.currentTarget) return;
						removeToast(toast.id);
					}}
				>
					<KindIcon kind={toast.kind} />
					<span className="min-w-0 flex-1 break-words text-ink">{toast.message}</span>
					{toast.action ? (
						<button
							type="button"
							aria-label={toast.action.label}
							onClick={() => {
								try {
									toast.action?.onClick();
								} catch (error) {
									console.error(error);
								}
								// Same animated-dismiss funnel as the X button: it
								// clears this toast's auto-dismiss timer first, so
								// the click cannot race the 3800ms timer.
								beginExit(toast.id);
							}}
							className="shrink-0 text-sm font-medium text-accent hover:underline underline-offset-2"
						>
							{toast.action.label}
						</button>
					) : null}
					<button
						type="button"
						aria-label="Dismiss notification"
						title="Dismiss"
						onClick={() => beginExit(toast.id)}
						className={dismissButtonClass}
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
			))}
		</div>
	);
}

export default ToastRegion;
