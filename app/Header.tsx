import { Link, NavLink } from "react-router";
import { ThemeToggle } from "./ThemeToggle";

/** Sticky glassy top bar: brand, theme toggle, settings link. */
export function Header() {
	return (
		<header className="sticky top-0 z-40 border-b border-hairline bg-page/75 backdrop-blur-md">
			<nav
				aria-label="Primary"
				className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
			>
				<Link
					to="/"
					className="flex items-center gap-2 font-display text-base font-bold tracking-tight text-ink transition duration-150 hover:opacity-90"
				>
					<span aria-hidden className="text-xl leading-none text-accent">
						◧
					</span>
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
