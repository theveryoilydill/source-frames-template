import { useEffect, useRef, useState } from "react";

const PANEL_ID = "sf-tags-menu-panel";

function ChevronIcon({ open }: { open: boolean }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
			aria-hidden
		>
			<path d="m6 9 6 6 6-6" />
		</svg>
	);
}

function CheckIcon({ visible }: { visible: boolean }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={`h-3.5 w-3.5 shrink-0 text-accent ${visible ? "opacity-100" : "opacity-0"}`}
			aria-hidden
		>
			<path d="m5 12.5 4.5 4.5L19 7.5" />
		</svg>
	);
}

/**
 * Animated dropdown for multi-tag filtering.
 *
 * The trigger is a pill button ("Tags" + chevron + selected-count badge); the
 * panel lists every known tag as an aria-pressed toggle with a staggered
 * entry animation (animate-menu-item-in tokens live in app.css), each row
 * optionally annotated with a faint per-tag frame count.
 *
 * SSR-safe: the open state starts false and every document listener lives in
 * a useEffect, so nothing touches window/document during render. Listeners
 * are removed on close and on unmount.
 */
export function TagsMenu({
	allTags,
	tagCounts,
	selected,
	onToggle,
	onClear,
}: {
	allTags: string[];
	tagCounts?: Record<string, number>;
	selected: string[];
	onToggle: (tag: string) => void;
	onClear: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [isClosing, setIsClosing] = useState(false);
	const isClosingRef = useRef(false);
	const escapeCloseRef = useRef(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);

	/** Unmounts the panel and restores focus after an Escape close. */
	const finishClose = () => {
		setOpen(false);
		setIsClosing(false);
		isClosingRef.current = false;
		if (escapeCloseRef.current) triggerRef.current?.focus();
		escapeCloseRef.current = false;
	};

	/** Every close path funnels through the exit animation. */
	const close = (refocus: boolean) => {
		if (isClosingRef.current) return;
		isClosingRef.current = true;
		escapeCloseRef.current = refocus;
		setIsClosing(true);
		// Safety net: background tabs throttle CSS animations, so
		// animationend may never fire — unmount anyway.
		window.setTimeout(finishClose, 240);
	};

	// Close on outside pointerdown; Escape closes and restores focus to the
	// trigger so keyboard users are never stranded.
	useEffect(() => {
		if (!open) return;

		const onPointerDown = (e: PointerEvent) => {
			const root = rootRef.current;
			if (root && e.target instanceof Node && !root.contains(e.target)) {
				close(false);
			}
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				close(true);
			}
		};

		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	const selectedCount = selected.length;

	return (
		<div ref={rootRef} className="relative">
			<button
				ref={triggerRef}
				type="button"
				aria-haspopup="menu"
				aria-expanded={open}
				aria-controls={PANEL_ID}
				aria-label={selectedCount > 0 ? `Tags, ${selectedCount} selected` : "Tags"}
				onClick={() => (open && !isClosing ? close(false) : setOpen((v) => !v))}
				className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition duration-150 ${
					open
						? "border-accent/40 bg-accent/10 text-ink"
						: "border-hairline text-muted hover:border-muted/60 hover:text-ink"
				}`}
			>
				Tags
				{selectedCount > 0 ? (
					<span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-white">
						{selectedCount}
					</span>
				) : null}
				<ChevronIcon open={open} />
			</button>

			{open ? (
				<div
					id={PANEL_ID}
					aria-label="Filter by tag"
					className={
						(isClosing ? "animate-menu-out" : "animate-menu-in") +
						" sf-thin-scroll absolute left-0 top-full z-20 mt-2 max-h-80 w-64 overflow-y-auto rounded-xl border border-hairline bg-surface p-1.5 shadow-lg"
					}
					onAnimationEnd={(e) => {
						// Only the panel's own menu-out run unmounts it; item
						// entrance animations bubble and must be ignored.
						if (!isClosing || e.target !== e.currentTarget) return;
						finishClose();
					}}
				>
					<div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
						<span className="text-[11px] font-medium text-muted">Filter by tag</span>
						{selectedCount > 0 ? (
							<button
								type="button"
								onClick={() => onClear()}
								className="text-xs font-medium text-muted transition duration-150 hover:text-ink"
							>
								Clear
							</button>
						) : null}
					</div>

					{allTags.length === 0 ? (
						<p className="px-2.5 py-2 text-xs text-muted">No tags yet</p>
					) : (
						allTags.map((tag, i) => {
							const active = selected.includes(tag);
							return (
								<button
									key={tag}
									type="button"
									aria-pressed={active}
									onClick={() => onToggle(tag)}
									className={`animate-menu-item-in flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition duration-150 ${
										active ? "bg-accent/10 text-ink" : "text-muted hover:bg-raised hover:text-ink"
									}`}
									style={{ animationDelay: `${i * 24}ms` }}
								>
									<CheckIcon visible={active} />
									<span className="truncate">{tag}</span>
									{tagCounts && tagCounts[tag] !== undefined ? (
										<span className="ml-auto shrink-0 text-[10px] font-normal tabular-nums text-muted/70">
											{tagCounts[tag]}
										</span>
									) : null}
								</button>
							);
						})
					)}
				</div>
			) : null}
		</div>
	);
}

export default TagsMenu;
