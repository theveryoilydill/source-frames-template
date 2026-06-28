import type { Route } from "./+types/home";
import React from "react";
import { FramesList, sources } from "../FramesList/GridFramesList";
import Header from "../Header";
import { useSettings } from "../context/UserData";

export function meta(_args: Route.MetaArgs) {
	return [
		{ title: "Source Frames [INSERT YOUR APP TITLE HERE]" },
		{ name: "description", content: "Welcome to React Router!" },
	];
}

export default function Home() {
  const [query, setQuery] = React.useState("");
	const [favoritesOnly, setFavoritesOnly] = React.useState(false);

	const { settings, setSettings } = useSettings();

	const favoritesSet = React.useMemo(
		() => new Set(settings.FavoriteNames ?? []),
		[settings.FavoriteNames],
	);

	const toggleFavorite = (name: string) => {
		setSettings((prev) => {
			const next = new Set(prev.FavoriteNames ?? []);
			if (next.has(name)) next.delete(name);
			else next.add(name);
			return { ...prev, FavoriteNames: Array.from(next) };
		});
	};

	return (
		<>
			<Header
				query={query}
				setQuery={setQuery}
				favoritesOnly={favoritesOnly}
				setFavoritesOnly={setFavoritesOnly}
				favoritesCount={favoritesSet.size}
				totalCount={sources.length}
			/>

			<main className="min-h-screen bg-gray-50 text-gray-950 dark:bg-gray-950 dark:text-white pt-6">
				<div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:px-8">
					<h1 className="sr-only">Source Frames</h1>
				</div>

				<FramesList
					query={query}
					favoritesOnly={favoritesOnly}
					favoritesSet={favoritesSet}
					onToggleFavorite={toggleFavorite}
				/>
			</main>
		</>
	);
}
