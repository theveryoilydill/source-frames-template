import { useCallback, useEffect, useRef, useState } from "react";

const iconButtonClass =
	"inline-flex h-9 w-9 items-center justify-center rounded-md text-muted transition duration-150 hover:bg-raised hover:text-ink active:scale-90";

const kbdClass =
	"rounded-md border border-hairline bg-raised px-1.5 py-0.5 font-mono text-[11px] text-muted";

const SHORTCUTS: { keys: string[]; description: string }[] = [
	{ keys: ["Ctrl K"], description: "Open the command palette" },
	{ keys: ["/"], description: "Focus search" },
	{ keys: ["F"], description: "Toggle the favorites filter" },
	{ keys: ["?"], description: "Show or hide this dialog" },
	{ keys: ["Esc"], description: "Close the viewer or this dialog" },
];

/**
 * Keyboard shortcuts help dialog. Every close path (button, Escape, "?",
 * backdrop click) funnels through the same overlay-out exit animation as the
 * frame viewer; a safety timer unmounts it if the exit event is throttled.
 */
export default function ShortcutsDialog({ onClose }: { onClose: () => void }) {
	const closeRef = useRef<HTMLButtonElement>(null);
	const isClosingRef = useRef(false);
	const [isClosing, setIsClosing] = useState(false);

	const beginClose = useCallback(() => {
		if (isClosingRef.current) return;
		isClosingRef.current = true;
		setIsClosing(true);
		// Safety net: background tabs throttle CSS animations, so
		// animationend may never fire — close anyway.
		window.setTimeout(() => {
			if (!isClosingRef.current) return;
			isClosingRef.current = false;
			onClose();
		}, 260);
	}, [onClose]);

	useEffect(() => {
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		closeRef.current?.focus();

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" || e.key === "?") {
				e.preventDefault();
				beginClose();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => {
			document.body.style.overflow = prevOverflow;
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [beginClose]);

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Keyboard shortcuts"
			className={`${
				isClosing ? "animate-overlay-out" : "animate-overlay-in"
			} fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4`}
			onAnimationEnd={(e) => {
				if (!isClosing || e.target !== e.currentTarget) return;
				isClosingRef.current = false;
				onClose();
			}}
			onClick={(e) => {
				if (e.target === e.currentTarget) beginClose();
			}}
		>
			<div className="w-full max-w-sm rounded-xl border border-hairline bg-surface p-6 shadow-xl">
				<div className="flex items-center justify-between gap-3">
					<h2 className="font-display text-lg font-semibold text-ink">Keyboard shortcuts</h2>
					<button
						ref={closeRef}
						type="button"
						aria-label="Close shortcuts"
						title="Close (Esc)"
						onClick={beginClose}
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
							<path d="M6 6l12 12M18 6 6 18" />
						</svg>
					</button>
				</div>

				<ul className="mt-4 divide-y divide-hairline">
					{SHORTCUTS.map((shortcut) => (
						<li
							key={shortcut.keys.join(" ")}
							className="flex items-center justify-between gap-6 py-2.5 text-sm text-ink"
						>
							<span>{shortcut.description}</span>
							<span className="flex shrink-0 items-center gap-1">
								{shortcut.keys.map((key) => (
									<kbd key={key} className={kbdClass}>
										{key}
									</kbd>
								))}
							</span>
						</li>
					))}
				</ul>

				<p className="mt-4 text-xs leading-5 text-muted">
					Tip: with the favorites filter on, drag cards (or press Alt + Arrow keys) to reorder them.
				</p>
			</div>
		</div>
	);
}
