import type { Route } from "./+types/home";
import React from "react";
import { FramesList, sources } from "../FramesList/FramesList";
import Header from "../Header";

export function meta(_args: Route.MetaArgs) {
	return [
		{ title: "Source Frames [INSERT YOUR APP TITLE HERE]" },
		{ name: "description", content: "Welcome to React Router!" },
	];
}

export default function Home() {
	const [query, setQuery] = React.useState("");
	const [favoritesOnly, setFavoritesOnly] = React.useState(false);
	const [favoritesSet, setFavoritesSet] = React.useState<Set<string>>(new Set());

	React.useEffect(() => {
		if (typeof window === "undefined") return;
		const raw = localStorage.getItem("sf:favorites");
		if (raw) {
			try {
				const arr = JSON.parse(raw) as string[];
				setFavoritesSet(new Set(arr));
			} catch {}
		}

		const handler = (e: Event) => {
			// read from event detail or storage
			const detail = (e as CustomEvent)?.detail;
			const arr =
				detail?.favorites ??
				(localStorage.getItem("sf:favorites")
					? JSON.parse(localStorage.getItem("sf:favorites")!)
					: []);
			setFavoritesSet(new Set(arr));
		};

		window.addEventListener("sf:favoritesUpdated", handler as EventListener);
		return () => window.removeEventListener("sf:favoritesUpdated", handler as EventListener);
	}, []);

	const toggleFavorite = (url: string) => {
		setFavoritesSet((prev) => {
			const next = new Set(prev);
			if (next.has(url)) next.delete(url);
			else next.add(url);
			try {
				localStorage.setItem("sf:favorites", JSON.stringify(Array.from(next)));
			} catch {}
			window.dispatchEvent(
				new CustomEvent("sf:favoritesUpdated", { detail: { favorites: Array.from(next) } }),
			);
			return next;
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
