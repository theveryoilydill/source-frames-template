import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

/** Sticky glassy top bar: brand, theme toggle, settings link. The bottom
 *  hairline warms to a faint accent tint once the page is scrolled, a quiet
 *  elevation cue that never changes the bar's size. */
export function Header() {
	const [scrolled, setScrolled] = useState(false);
	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 8);
		// Sync once on mount (scroll restoration can land mid-page).
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	return (
		<header
			className={`sticky top-0 z-40 border-b bg-page/80 backdrop-blur-md transition-colors duration-200 ${
				scrolled ? "border-accent/15" : "border-hairline"
			}`}
		>
			<nav
				aria-label="Primary"
				className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
			>
				<Link
					to="/"
					className="flex items-center gap-2 font-display text-base font-bold tracking-tight text-ink transition duration-150 hover:opacity-90"
				>
					<Logo className="h-6 w-6 shrink-0 text-accent" />
					Source Frames
				</Link>

				<div className="flex items-center gap-2">
					<ThemeToggle />
					<NavLink
						to="/settings"
						className={({ isActive }) =>
							`rounded-lg border px-3 py-1.5 text-sm font-medium transition duration-150 ${
								isActive
									? "border-hairline bg-raised text-ink"
									: "border-transparent text-muted hover:bg-raised hover:text-ink"
							}`
						}
					>
						Settings
					</NavLink>
				</div>
			</nav>
		</header>
	);
}

export default Header;
