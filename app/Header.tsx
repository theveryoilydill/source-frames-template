import React from "react";
import { Link } from "react-router";

export function Header({
	query,
	setQuery,
	favoritesOnly,
	setFavoritesOnly,
	favoritesCount,
	totalCount,
}: {
	query: string;
	setQuery: (q: string) => void;
	favoritesOnly: boolean;
	setFavoritesOnly: (v: boolean) => void;
	favoritesCount: number;
	totalCount: number;
}) {
	const viewLabel = favoritesOnly ? `Favorites (${favoritesCount})` : `All (${totalCount})`;

	return (
		<header className="sticky top-0 z-40 w-full border-b border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
			<div className="mx-auto flex max-w-6xl items-center gap-4 sm:gap-6">
				<div className="flex items-center gap-3">
					<Link to="/" className="text-lg font-semibold text-gray-900 dark:text-white">
						<span className="inline-block mr-2 text-blue-600">◧</span>
						Source Frames
					</Link>
				</div>

				<div className="flex flex-1 items-center">
					<label className="sr-only">Search sources</label>
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search name or description..."
						className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-white"
					/>
				</div>

				<div className="flex items-center gap-3">
					<button
						type="button"
						aria-pressed={favoritesOnly}
						onClick={() => setFavoritesOnly(!favoritesOnly)}
						className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
					>
						{viewLabel}
					</button>

					<Link
						to="/settings"
						className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300"
					>
						Settings
					</Link>
				</div>
			</div>
		</header>
	);
}

export default Header;
