import { useState } from "react";
import FrameItem from "./FrameItem";
import type { SourceData } from "../data/sources";
import FrameContent from "../FrameContent/FrameContent";

/**
 * Renders the (already filtered) frame card grid and hosts the fullscreen
 * frame viewer overlay.
 */
export function FramesList({
	filtered,
	favoritesSet,
	onToggleFavorite,
	onResetFilters,
}: {
	filtered: SourceData[];
	favoritesSet?: Set<string>;
	onToggleFavorite?: (url: string) => void;
	onResetFilters?: () => void;
}) {
	const favs = favoritesSet ?? new Set<string>();

	const [openUrl, setOpenUrl] = useState<string | null>(null);
	const [openTitle, setOpenTitle] = useState<string | undefined>(undefined);

	const closeOverlay = () => {
		setOpenUrl(null);
		setOpenTitle(undefined);
	};

	return (
		<section aria-label="Frame results">
			{filtered.length === 0 ? (
				<div className="rounded-xl border border-dashed border-hairline bg-surface/50 px-6 py-16 text-center">
					<p className="font-display text-lg font-semibold text-ink">No frames found</p>
					<p className="mt-1 text-sm text-muted">
						Try a different search, category, or clear the favorites filter.
					</p>
					{onResetFilters ? (
						<button
							type="button"
							onClick={onResetFilters}
							className="mt-5 inline-flex items-center rounded-lg border border-hairline bg-raised px-3.5 py-2 text-sm font-medium text-ink transition duration-150 hover:border-accent/40"
						>
							Clear filters
						</button>
					) : null}
				</div>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{filtered.map((source) => (
						<FrameItem
							key={source.URL}
							source={source}
							isFavorite={favs.has(source.URL)}
							onToggleFavorite={onToggleFavorite}
							onOpen={(url, title) => {
								setOpenUrl(url);
								setOpenTitle(title);
							}}
						/>
					))}
				</div>
			)}

			{openUrl ? <FrameContent url={openUrl} title={openTitle} onClose={closeOverlay} /> : null}
		</section>
	);
}

export default FramesList;
