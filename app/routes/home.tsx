import type { Route } from "./+types/home";
import { useEffect, useMemo, useRef, useState } from "react";
import Header from "../Header";
import Footer from "../Footer";
import FramesList from "../FramesList/FramesList";
import { sources } from "../data/sources";

export function meta(_args: Route.MetaArgs) {
	const title = "Source Frames — open your sources in place";
	const description =
		"Open tools, references, and live readouts in framed overlays without leaving the page, with search, categories, and favorites.";
	return [
		{ title },
		{ name: "description", content: description },
		{ property: "og:title", content: title },
		{ property: "og:description", content: description },
		{ property: "og:type", content: "website" },
		{ name: "twitter:card", content: "summary" },
	];
}

function SearchIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			className="h-5 w-5"
			aria-hidden
		>
			<circle cx="11" cy="11" r="7" />
			<path d="m21 21-4.3-4.3" />
		</svg>
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
			className="h-4 w-4"
			aria-hidden
		>
			<path d="M12 20.5c-.3 0-.6-.1-.8-.3C6.4 16.4 3 13.4 3 9.9 3 7.2 5.1 5 7.8 5c1.6 0 3.1.8 4.2 2.1C13.1 5.8 14.6 5 16.2 5 18.9 5 21 7.2 21 9.9c0 3.5-3.4 6.5-8.2 10.3-.2.2-.5.3-.8.3Z" />
		</svg>
	);
}

export default function Home() {
	const [query, setQuery] = useState("");
	const [favoritesOnly, setFavoritesOnly] = useState(false);
	const [category, setCategory] = useState("All");
	const [favoritesSet, setFavoritesSet] = useState<Set<string>>(new Set());
	const searchRef = useRef<HTMLInputElement>(null);

	// Load favorites once and stay in sync across components via the
	// "sf:favoritesUpdated" CustomEvent.
	useEffect(() => {
		if (typeof window === "undefined") return;
		const raw = localStorage.getItem("sf:favorites");
		if (raw) {
			try {
				setFavoritesSet(new Set(JSON.parse(raw) as string[]));
			} catch {}
		}

		const handler = (e: Event) => {
			const detail = (e as CustomEvent)?.detail;
			let arr: string[] = detail?.favorites ?? [];
			if (!detail?.favorites) {
				try {
					const raw = localStorage.getItem("sf:favorites");
					arr = raw ? (JSON.parse(raw) as string[]) : [];
				} catch {
					arr = [];
				}
			}
			setFavoritesSet(new Set(arr));
		};

		window.addEventListener("sf:favoritesUpdated", handler as EventListener);
		return () => window.removeEventListener("sf:favoritesUpdated", handler as EventListener);
	}, []);

	// Press "/" anywhere to jump into the search field.
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
			const target = e.target as HTMLElement | null;
			if (
				target &&
				(target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA" ||
					target.tagName === "SELECT" ||
					target.isContentEditable)
			) {
				return;
			}
			e.preventDefault();
			searchRef.current?.focus();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	const categories = useMemo(
		() => Array.from(new Set(sources.map((source) => source.category ?? "General"))).sort(),
		[],
	);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return sources.filter((source) => {
			if (category !== "All" && (source.category ?? "General") !== category) return false;
			if (q) {
				const nameMatch = source.name.toLowerCase().includes(q);
				const descMatch = (source.description ?? "").toLowerCase().includes(q);
				if (!nameMatch && !descMatch) return false;
			}
			if (favoritesOnly && !favoritesSet.has(source.URL)) return false;
			return true;
		});
	}, [query, category, favoritesOnly, favoritesSet]);

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

	const resetFilters = () => {
		setQuery("");
		setCategory("All");
		setFavoritesOnly(false);
	};

	return (
		<div className="flex min-h-dvh flex-col">
			<Header />

			<main className="flex-1">
				<section className="border-b border-hairline">
					<div className="mx-auto w-full max-w-6xl px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:px-8">
						{/* The one bold element: the product's own name, framed by the
                                                    same viewfinder brackets the cards answer to. */}
						<div className="relative mt-2 inline-block px-6 py-5 sm:px-8">
							<span aria-hidden className="pointer-events-none absolute inset-0">
								<span className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-accent" />
								<span className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-accent" />
								<span className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-accent" />
								<span className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-accent" />
							</span>
							<h1 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl lg:text-6xl">
								Source Frames
							</h1>
						</div>

						<p className="mt-4 max-w-xl text-base text-muted sm:text-lg">
							Open tools, references, and live readouts in framed overlays without leaving the page.
						</p>

						<div className="relative mt-8 max-w-xl">
							<span
								aria-hidden
								className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
							>
								<SearchIcon />
							</span>
							<input
								ref={searchRef}
								type="search"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Search frames"
								aria-label="Search frames"
								className="h-12 w-full rounded-xl border border-hairline bg-surface pl-11 pr-12 text-sm text-ink shadow-sm transition duration-200 placeholder:text-muted/70 focus:border-accent/60 focus:outline-none focus:ring-4 focus:ring-accent/25"
							/>
							<kbd
								aria-hidden
								className="pointer-events-none absolute right-3.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-hairline bg-raised px-1.5 py-0.5 font-mono text-[11px] text-muted sm:block"
							>
								/
							</kbd>
						</div>
					</div>
				</section>

				<section
					aria-label="Filters and results"
					className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8"
				>
					<div className="flex flex-wrap items-center gap-2 border-b border-hairline pb-5">
						<div
							role="group"
							aria-label="Filter by category"
							className="flex flex-wrap items-center gap-2"
						>
							{["All", ...categories].map((option) => {
								const active = category === option;
								return (
									<button
										key={option}
										type="button"
										aria-pressed={active}
										onClick={() => setCategory(option)}
										className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition duration-150 ${
											active
												? "border-accent/40 bg-accent/10 text-ink"
												: "border-hairline text-muted hover:border-muted/60 hover:text-ink"
										}`}
									>
										{option}
									</button>
								);
							})}
						</div>

						<div className="ml-auto flex items-center gap-3">
							<button
								type="button"
								aria-pressed={favoritesOnly}
								onClick={() => setFavoritesOnly(!favoritesOnly)}
								className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition duration-150 ${
									favoritesOnly
										? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-500"
										: "border-hairline text-muted hover:border-muted/60 hover:text-ink"
								}`}
							>
								<HeartIcon filled={favoritesOnly} />
								Favorites
							</button>
							<p role="status" className="text-xs text-muted">
								{filtered.length} of {sources.length} shown
							</p>
						</div>
					</div>

					<div className="pt-6">
						<FramesList
							filtered={filtered}
							favoritesSet={favoritesSet}
							onToggleFavorite={toggleFavorite}
							onResetFilters={resetFilters}
						/>
					</div>
				</section>
			</main>

			<Footer />
		</div>
	);
}
