import type { SourceData } from "../data/sources";

function getHostname(sourceUrl: string) {
	try {
		return new URL(sourceUrl).hostname.replace(/^www\./, "");
	} catch {
		return sourceUrl;
	}
}

const openControlClass =
	"bg-accent inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition duration-150 hover:opacity-90";

const heartButtonClass =
	"inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-muted transition duration-200 hover:border-hairline hover:bg-raised hover:text-ink";

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

export function FrameItem({
	source,
	isFavorite = false,
	onToggleFavorite,
	onOpen,
}: {
	source: SourceData;
	isFavorite?: boolean;
	onToggleFavorite?: (url: string) => void;
	onOpen?: (url: string, title?: string) => void;
}) {
	const hostname = getHostname(source.URL);
	const isLink = source.kind === "link";

	return (
		<article className="group relative flex h-full flex-col rounded-xl border border-hairline bg-surface p-5 transition duration-150 hover:border-accent/40">
			<ViewfinderCorners />

			<div className="flex-1">
				<p className="text-xs text-muted">{source.category ?? "General"}</p>

				<h2 className="mt-1.5 font-display text-lg font-semibold leading-snug text-ink">
					{source.name}
				</h2>

				{source.description ? (
					<p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
						{source.description}
					</p>
				) : null}
			</div>

			<div className="mt-5 flex items-center justify-between gap-3 border-t border-hairline pt-4">
				<span className="min-w-0 truncate text-xs text-muted">{hostname}</span>

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
