import { useEffect, useState } from "react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import type { Route } from "./+types/settings";
import Header from "../Header";
import Footer from "../Footer";
import ErrorPanel from "../ErrorPanel";
import { applyTheme, readStoredChoice, type ThemeChoice } from "../theme";

const APP_VERSION = "2.1.0";

export function meta(_args: Route.MetaArgs) {
	const title = "Settings — Source Frames";
	const description = "Choose your theme and manage locally stored favorites for Source Frames.";
	return [
		{ title },
		{ name: "description", content: description },
		{ property: "og:title", content: title },
		{ property: "og:description", content: description },
		{ property: "og:type", content: "website" },
	];
}

export function ErrorBoundary() {
	const error = useRouteError();

	let code = "ERR";
	let title = "Something went wrong";
	let details = "An unexpected error occurred while loading settings.";
	let stack: string | undefined;

	if (isRouteErrorResponse(error)) {
		code = String(error.status);
		title = error.status === 404 ? "Page not found" : "Request failed";
		details =
			error.status === 404
				? "Nothing lives at this address. Check the URL, or return to the console."
				: error.statusText || details;
	} else if (import.meta.env.DEV && error instanceof Error) {
		details = error.message;
		stack = error.stack;
	}

	return <ErrorPanel code={code} title={title} details={details} stack={stack} />;
}

const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
	{ value: "system", label: "System" },
	{ value: "light", label: "Light" },
	{ value: "dark", label: "Dark" },
];

function OptionIcon({ value }: { value: ThemeChoice }) {
	const common = {
		xmlns: "http://www.w3.org/2000/svg",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 1.8,
		strokeLinecap: "round",
		strokeLinejoin: "round",
		className: "h-4 w-4",
		"aria-hidden": true,
	} as const;

	if (value === "system") {
		return (
			<svg {...common}>
				<rect x="2.5" y="4" width="19" height="13" rx="2" />
				<path d="M8 21h8m-4-4v4" />
			</svg>
		);
	}
	if (value === "light") {
		return (
			<svg {...common}>
				<circle cx="12" cy="12" r="4" />
				<path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
			</svg>
		);
	}
	return (
		<svg {...common}>
			<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
		</svg>
	);
}

export default function Settings() {
	const [choice, setChoice] = useState<ThemeChoice>("system");
	const [favoritesCount, setFavoritesCount] = useState(0);
	const [confirmingClear, setConfirmingClear] = useState(false);

	useEffect(() => {
		setChoice(readStoredChoice());

		const readFavorites = () => {
			try {
				const raw = localStorage.getItem("sf:favorites");
				setFavoritesCount(raw ? (JSON.parse(raw) as string[]).length : 0);
			} catch {
				setFavoritesCount(0);
			}
		};
		readFavorites();

		window.addEventListener("sf:favoritesUpdated", readFavorites);
		return () => window.removeEventListener("sf:favoritesUpdated", readFavorites);
	}, []);

	const handleChoice = (next: ThemeChoice) => {
		setChoice(next);
		applyTheme(next);
	};

	const clearFavorites = () => {
		localStorage.removeItem("sf:favorites");
		window.dispatchEvent(new CustomEvent("sf:favoritesUpdated", { detail: { favorites: [] } }));
		setFavoritesCount(0);
		setConfirmingClear(false);
	};

	return (
		<div className="flex min-h-dvh flex-col">
			<Header />

			<main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
				<Link
					to="/"
					className="inline-flex items-center gap-1.5 text-sm text-muted transition duration-150 hover:text-ink"
				>
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
						<path d="M19 12H5m6-6-6 6 6 6" />
					</svg>
					Back to console
				</Link>

				<h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink">Settings</h1>
				<p className="mt-2 text-sm text-muted">
					Choose how the console looks and manage data stored in this browser.
				</p>

				<section
					aria-labelledby="appearance-heading"
					className="mt-8 rounded-xl border border-hairline bg-surface p-6"
				>
					<h2 id="appearance-heading" className="font-display text-lg font-semibold text-ink">
						Appearance
					</h2>
					<p className="mt-1 text-sm text-muted">Pick a theme. System follows your OS setting.</p>

					<fieldset className="mt-4">
						<legend className="sr-only">Theme</legend>
						<div className="flex flex-wrap gap-2">
							{THEME_OPTIONS.map((option) => {
								const active = choice === option.value;
								return (
									<label
										key={option.value}
										className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
											active
												? "border-accent/50 bg-accent/10 text-ink"
												: "border-hairline text-muted hover:bg-raised hover:text-ink"
										}`}
									>
										<input
											type="radio"
											name="theme"
											value={option.value}
											checked={active}
											onChange={() => handleChoice(option.value)}
											className="sr-only"
										/>
										<OptionIcon value={option.value} />
										{option.label}
									</label>
								);
							})}
						</div>
					</fieldset>
				</section>

				<section
					aria-labelledby="data-heading"
					className="mt-4 rounded-xl border border-hairline bg-surface p-6"
				>
					<h2 id="data-heading" className="font-display text-lg font-semibold text-ink">
						Data
					</h2>
					<p className="mt-1 text-sm text-muted" role="status">
						{favoritesCount} {favoritesCount === 1 ? "favorite" : "favorites"} stored locally in
						this browser.
					</p>

					<div className="mt-4">
						{confirmingClear ? (
							<div className="flex flex-wrap items-center gap-2.5">
								<span className="text-sm font-medium text-red-600 dark:text-red-500">
									This removes every favorite stored in this browser.
								</span>
								<button
									type="button"
									onClick={clearFavorites}
									className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-red-500"
								>
									Clear favorites
								</button>
								<button
									type="button"
									onClick={() => setConfirmingClear(false)}
									className="rounded-lg border border-hairline px-3.5 py-2 text-sm font-medium text-muted transition duration-150 hover:text-ink"
								>
									Cancel
								</button>
							</div>
						) : (
							<button
								type="button"
								onClick={() => setConfirmingClear(true)}
								disabled={favoritesCount === 0}
								className="rounded-lg border border-red-500/40 px-3.5 py-2 text-sm font-medium text-red-600 dark:text-red-500 transition duration-150 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
							>
								Clear favorites
							</button>
						)}
					</div>
				</section>

				<section
					aria-labelledby="about-heading"
					className="mt-4 rounded-xl border border-hairline bg-surface p-6"
				>
					<h2 id="about-heading" className="font-display text-lg font-semibold text-ink">
						About
					</h2>
					<div className="mt-3 flex flex-wrap items-center gap-2.5">
						<span className="rounded-full border border-hairline bg-raised px-2.5 py-1 text-xs font-medium text-muted">
							v{APP_VERSION}
						</span>
						<a
							href="https://github.com/theveryoilydill/source-frames-template"
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1 text-sm font-medium text-accent-text transition duration-150 hover:opacity-90"
						>
							GitHub repository
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth={1.8}
								strokeLinecap="round"
								strokeLinejoin="round"
								className="h-3.5 w-3.5"
								aria-hidden
							>
								<path d="M7 17 17 7M9 7h8v8" />
							</svg>
						</a>
					</div>
					<p className="mt-3 text-sm text-muted">
						Source Frames is free software released under the AGPL-3.0 license.
					</p>
				</section>
			</main>

			<Footer />
		</div>
	);
}
