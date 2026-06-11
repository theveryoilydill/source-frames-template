import React from "react";
import { Link } from "react-router";
import type { Route } from "./+types/settings";
import { useRouteError } from "react-router";

export function ErrorBoundary() {
  const error = useRouteError();

  return (
    <pre>
      {error instanceof Error
        ? error.stack
        : JSON.stringify(error, null, 2)}
    </pre>
  );
}

export function meta(_args: Route.MetaArgs) {
	return [{ title: "Settings" }, { name: "description", content: "The settings page" }];
}

export default function Settings() {
	const [cleared, setCleared] = React.useState(false);

	const clearFavorites = () => {
		if (typeof window === "undefined") return;
		localStorage.removeItem("sf:favorites");
		window.dispatchEvent(new CustomEvent("sf:favoritesUpdated", { detail: { favorites: [] } }));
		setCleared(true);
	};

	return (
		<main className="min-h-screen bg-gray-50 text-gray-950 dark:bg-gray-950 dark:text-white">
			<div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
				<h1 className="text-2xl font-semibold">Settings</h1>

				<section className="mt-6 rounded-md border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
					<h2 className="text-lg font-medium">Favorites</h2>
					<p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
						Manage saved favorites for quick access.
					</p>

					<div className="mt-4 flex items-center gap-3">
						<button
							onClick={clearFavorites}
							className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
						>
							Clear favorites
						</button>

						{cleared && <span className="text-sm text-gray-600 dark:text-gray-400">Cleared</span>}
					</div>
				</section>

				<div className="mt-6">
					<Link to="/" className="text-sm text-blue-600">
						Back to home
					</Link>
				</div>
			</div>
		</main>
	);
}
