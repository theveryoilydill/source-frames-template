import React, { useState } from "react";
import { FrameItem, type SourceData } from "./FrameItem";
import FrameContent from "../FrameContent/FrameContent";

export function FramesList({
	query = "",
	favoritesOnly = false,
	favoritesSet,
	onToggleFavorite,
}: {
	query?: string;
	favoritesOnly?: boolean;
	favoritesSet?: Set<string>;
	onToggleFavorite?: (url: string) => void;
}) {
	const q = query.trim().toLowerCase();
	const favs = favoritesSet ?? new Set<string>();

	const [openUrl, setOpenUrl] = useState<string | null>(null);
	const [openTitle, setOpenTitle] = useState<string | undefined>(undefined);

	const handleOpen = (url: string, title?: string) => {
		setOpenUrl(url);
		setOpenTitle(title);
	};

	const closeOverlay = () => {
		setOpenUrl(null);
		setOpenTitle(undefined);
	};

	const filtered = sources.filter((s) => {
		if (q) {
			const nameMatch = s.name.toLowerCase().includes(q);
			const descMatch = (s.description ?? "").toLowerCase().includes(q);
			if (!nameMatch && !descMatch) return false;
		}
		if (favoritesOnly && !favs.has(s.URL)) return false;
		return true;
	});

	return (
		<section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
			<div className="mb-6 flex flex-col gap-3 border-b border-gray-200 pb-5 dark:border-gray-800 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p className="text-sm font-medium text-blue-600 dark:text-blue-400">Source library</p>
					<h2 className="mt-1 text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">
						Frames ready to explore
					</h2>
				</div>
				<p className="text-sm text-gray-600 dark:text-gray-400">{filtered.length} results</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{filtered.map((source) => (
					<FrameItem
						key={source.URL}
						source={source}
						isFavorite={favs.has(source.URL)}
						onToggleFavorite={onToggleFavorite}
						onOpen={handleOpen}
					/>
				))}
			</div>

			{openUrl ? <FrameContent url={openUrl} title={openTitle} onClose={closeOverlay} /> : null}
		</section>
	);
}

export const sources: SourceData[] = [
	{
		name: "Source 1",
		URL: "https://example.com/source1",
		description: "A clean starting point for frame content and external references.",
		category: "Reference",
	},
	{
		name: "Source 2",
		URL: "https://example.com/source2",
		description: "Use this slot for a second frame, article, dataset, or project link.",
		category: "Resource",
	},
];
