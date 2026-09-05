export type ThemeChoice = "system" | "light" | "dark";

export const THEME_KEY = "sf:theme";
export const THEME_EVENT = "sf:themeChanged";

/** Reads the stored theme choice; absent storage means "follow the system". */
export function readStoredChoice(): ThemeChoice {
	if (typeof window === "undefined") return "system";
	try {
		const stored = localStorage.getItem(THEME_KEY);
		return stored === "light" || stored === "dark" ? stored : "system";
	} catch {
		return "system";
	}
}

export function systemPrefersDark(): boolean {
	return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Applies a theme choice to <html> (class + color-scheme), persists it to
 * localStorage, and dispatches THEME_EVENT so other components stay in sync.
 * Returns the resolved theme ("light" | "dark").
 */
export function applyTheme(choice: ThemeChoice): "light" | "dark" {
	const resolved = choice === "system" ? (systemPrefersDark() ? "dark" : "light") : choice;
	const root = document.documentElement;
	root.classList.toggle("dark", resolved === "dark");
	root.style.colorScheme = resolved;
	try {
		if (choice === "system") localStorage.removeItem(THEME_KEY);
		else localStorage.setItem(THEME_KEY, choice);
	} catch {
		/* storage unavailable — theme still applies for this session */
	}
	window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme: resolved, choice } }));
	return resolved;
}
