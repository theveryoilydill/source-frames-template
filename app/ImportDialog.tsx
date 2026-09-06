import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusTrap } from "./useFocusTrap";
import type { CustomFrame } from "./data/customFrames";
import type { RecentEntry } from "./data/recent";

/**
 * Validated contents of one import file, ready to show in the preview and
 * hand to the data writers. Counts are already junk-free, so what the dialog
 * lists is exactly what an import would write.
 */
export type ImportPreviewData = {
	fileName: string;
	exportedAt: string | null;
	favorites: string[];
	recents: RecentEntry[];
	customFrames: CustomFrame[];
};

/** Which collections the user chose to import; unchecked ones stay untouched. */
export type ImportSelection = {
	favorites: boolean;
	recents: boolean;
	customFrames: boolean;
};

type ImportDialogProps = {
	preview: ImportPreviewData;
	onClose: () => void;
	onConfirm: (selection: ImportSelection) => void;
};

const COLLECTION_ROWS: { key: keyof ImportSelection; label: string }[] = [
	{ key: "favorites", label: "Favorites" },
	{ key: "recents", label: "Recents" },
	{ key: "customFrames", label: "Custom frames" },
];

const rowClass = (checked: boolean) =>
	`flex w-full cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
		checked
			? "border-accent/50 bg-accent/10 text-ink"
			: "border-hairline text-muted hover:bg-raised hover:text-ink"
	}`;

/** Small checkbox glyph matching the theme radio rows' inline-icon look. */
function CheckGlyph({ checked }: { checked: boolean }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.8}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={`h-4 w-4 shrink-0 ${checked ? "text-accent" : "text-muted"}`}
			aria-hidden
		>
			<rect x="3.5" y="3.5" width="17" height="17" rx="4" />
			{checked && <path d="m8.5 12.5 2.5 2.5 5-6" />}
		</svg>
	);
}

/**
 * Import preview dialog. Lists the collections an import file would actually
 * write (validated up front, so the counts match the result) and lets the
 * user pick which ones to bring in. A focus trap keeps keyboard focus inside
 * the dialog (initial focus on the first collection checkbox; focus returns
 * to the import trigger on close). Every close path (Cancel, Escape,
 * backdrop click) funnels through the same overlay-out exit animation as the
 * shortcuts dialog and frame viewer; a safety timer unmounts it if the exit
 * event is throttled.
 */
export default function ImportDialog({ preview, onClose, onConfirm }: ImportDialogProps) {
	const headingRef = useRef<HTMLHeadingElement>(null);
	const firstCheckboxRef = useRef<HTMLInputElement>(null);
	const overlayRef = useRef<HTMLDivElement>(null);
	const isClosingRef = useRef(false);
	const [isClosing, setIsClosing] = useState(false);
	const [selection, setSelection] = useState<ImportSelection>({
		favorites: true,
		recents: true,
		customFrames: true,
	});

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

	/**
	 * Focus trap for the dialog. ImportDialog is only mounted while a preview
	 * exists (settings.tsx renders it conditionally), so the trap is armed for
	 * its whole lifetime and `active` is constant true. Declared before the
	 * effect below per the useFocusTrap integration note, so the restore
	 * target is captured while the import trigger still holds focus. The hook
	 * owns initial focus — first collection checkbox, falling back to the
	 * heading — replacing the old manual focus line, and restores focus on
	 * unmount (the parent's closeImportDialog refocuses the trigger too; the
	 * hook's restore no-ops when focus is already there).
	 */
	useFocusTrap(true, overlayRef, {
		initialFocus: () => firstCheckboxRef.current ?? headingRef.current,
		onEscape: beginClose,
	});

	useEffect(() => {
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
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

	const rows = COLLECTION_ROWS.map((row) => ({ ...row, count: preview[row.key].length })).filter(
		(row) => row.count > 0,
	);
	const selectedCount = rows.filter((row) => selection[row.key]).length;
	const exportedAtText =
		preview.exportedAt && Number.isFinite(Date.parse(preview.exportedAt))
			? new Date(preview.exportedAt).toLocaleString()
			: "Unknown date";

	const toggle = (key: keyof ImportSelection) =>
		setSelection((prev) => ({ ...prev, [key]: !prev[key] }));

	return (
		<div
			ref={overlayRef}
			role="dialog"
			aria-modal="true"
			aria-labelledby="import-dialog-heading"
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
			<div className="w-full max-w-md rounded-2xl border border-hairline bg-surface p-6 shadow-lg">
				<h2
					id="import-dialog-heading"
					ref={headingRef}
					tabIndex={-1}
					className="font-display text-lg font-semibold text-ink outline-none"
				>
					Import data
				</h2>
				<p className="mt-1 text-sm text-muted">
					{preview.fileName} · {exportedAtText}
				</p>
				<p className="mt-3 text-sm text-muted">
					Choose what to bring in. Selected collections replace what is stored now; the rest is left
					untouched.
				</p>

				<div className="mt-4 flex flex-col gap-2">
					{rows.map((row, index) => (
						<label key={row.key} className={rowClass(selection[row.key])}>
							<input
								ref={index === 0 ? firstCheckboxRef : undefined}
								type="checkbox"
								checked={selection[row.key]}
								onChange={() => toggle(row.key)}
								className="sr-only"
							/>
							<CheckGlyph checked={selection[row.key]} />
							{row.label} ({row.count})
						</label>
					))}
				</div>

				<div className="mt-5 flex flex-wrap items-center justify-end gap-2.5">
					<button
						type="button"
						onClick={beginClose}
						className="rounded-full border border-hairline px-4 py-2 text-sm font-medium text-muted transition duration-150 hover:bg-raised hover:text-ink"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={() => onConfirm(selection)}
						disabled={selectedCount === 0}
						className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition duration-150 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
					>
						{`Import ${selectedCount} selected`}
					</button>
				</div>
			</div>
		</div>
	);
}
