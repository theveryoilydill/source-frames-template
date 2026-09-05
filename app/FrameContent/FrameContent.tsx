import { useEffect, useRef } from "react";

type FrameContentProps = {
	url: string;
	onClose?: () => void;
	title?: string;
};

const iconButtonClass =
	"inline-flex h-9 w-9 items-center justify-center rounded-md text-muted transition duration-150 hover:bg-raised hover:text-ink";

/**
 * Fullscreen sandboxed frame viewer. Escape closes (via onClose, else
 * history.back()); body scroll is locked while open; focus moves to the close
 * button so keyboard users are inside the dialog.
 */
export default function FrameContent({ url, onClose, title }: FrameContentProps) {
	const closeRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				if (onClose) onClose();
				else window.history.back();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		closeRef.current?.focus();
		return () => {
			document.body.style.overflow = prevOverflow;
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [onClose]);

	if (!url) return null;

	const canPopOut = /^https?:\/\//i.test(url);

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label={title ?? "Frame viewer"}
			className="animate-overlay-in fixed inset-0 z-[9999] flex flex-col bg-black/80"
		>
			<div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-hairline bg-page/85 px-3 backdrop-blur-md">
				<div className="flex min-w-0 items-center gap-2.5">
					<span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-glow" />
					<span className="hidden shrink-0 text-xs font-semibold text-muted sm:inline">
						Live
					</span>
					<span className="truncate text-sm font-medium text-ink">{title ?? url}</span>
				</div>

				<div className="flex shrink-0 items-center gap-1.5">
					{canPopOut ? (
						<a
							href={url}
							target="_blank"
							rel="noopener noreferrer"
							aria-label="Open in new tab"
							title="Open in new tab"
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
						</a>
					) : null}
					<button
						type="button"
						ref={closeRef}
						aria-label="Close frame"
						title="Close (Esc)"
						onClick={() => (onClose ? onClose() : window.history.back())}
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
			</div>

			<iframe
				src={url}
				title={title ?? url}
				className="h-full w-full flex-1 border-0 bg-white"
				sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
			/>
		</div>
	);
}
