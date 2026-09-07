import { useEffect } from "react";
import { THEME_KEY, applyTheme, readStoredChoice } from "./theme";

function SunIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.8}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={`h-[18px] w-[18px] ${className ?? ""}`}
			aria-hidden
		>
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
		</svg>
	);
}

function MoonIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.8}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={`h-[18px] w-[18px] ${className ?? ""}`}
			aria-hidden
		>
			<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
		</svg>
	);
}

/**
 * Header control that flips between light and dark. Which icon shows is
 * decided purely by CSS (`dark:` variant), so the prerendered HTML is always
 * correct — no hydration mismatch, no wrong icon before React mounts.
 */
export function ThemeToggle() {
	// Keep <html> in sync with other tabs (storage event) and with OS-level
	// scheme flips while the choice is "system".
	useEffect(() => {
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const onSystemChange = () => {
			if (readStoredChoice() === "system") applyTheme("system");
		};
		const onStorage = (event: StorageEvent) => {
			if (event.key === THEME_KEY || event.key === null) applyTheme(readStoredChoice());
		};
		media.addEventListener("change", onSystemChange);
		window.addEventListener("storage", onStorage);
		return () => {
			media.removeEventListener("change", onSystemChange);
			window.removeEventListener("storage", onStorage);
		};
	}, []);

	return (
		<button
			type="button"
			aria-label="Toggle theme"
			title="Toggle theme"
			onClick={() =>
				applyTheme(document.documentElement.classList.contains("dark") ? "light" : "dark")
			}
			className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-hairline text-muted transition duration-150 hover:bg-raised hover:text-ink"
		>
			{/* Sun invites switching to light (shown in dark mode); moon the reverse. */}
			<SunIcon className="hidden dark:block" />
			<MoonIcon className="dark:hidden" />
		</button>
	);
}

export default ThemeToggle;
