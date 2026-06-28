import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface Settings {
	FavoriteNames: string[];
}

interface SettingsContextType {
	settings: Settings;
	setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

const defaultSettings: Settings = {
	FavoriteNames: [],
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
	const [settings, setSettings] = useState<Settings>(defaultSettings);

	// Load settings after hydration and normalize legacy shape
	useEffect(() => {
		try {
			const savedRaw = localStorage.getItem("settings");
			if (savedRaw) {
				const parsed = JSON.parse(savedRaw);
				const favoriteList: string[] =
					parsed?.favorites ??
					(Array.isArray(parsed?.FavoriteIndexes) ? parsed.FavoriteIndexes.map(String) : []);
				setSettings({
					...defaultSettings,
					...parsed,
					favorites: favoriteList,
				});
			}
		} catch (error) {
			console.error("Failed to load settings:", error);
		}
	}, []);

	// Listen for storage changes (other tabs)
	useEffect(() => {
		const handler = (e: StorageEvent) => {
			if (e.key === "settings") {
				try {
					const parsed = e.newValue ? JSON.parse(e.newValue) : null;
					if (parsed) {
						const favoriteList: string[] =
							parsed?.favorites ??
							(Array.isArray(parsed?.FavoriteIndexes) ? parsed.FavoriteIndexes.map(String) : []);
						setSettings({
							...defaultSettings,
							...parsed,
							favorites: favoriteList,
						});
					}
				} catch {}
			}
		};

		window.addEventListener("storage", handler);
		return () => window.removeEventListener("storage", handler);
	}, []);

	// Save whenever settings change
	useEffect(() => {
		try {
			localStorage.setItem("settings", JSON.stringify(settings));
		} catch (error) {
			console.error("Failed to save settings:", error);
		}
	}, [settings]);

	return (
		<SettingsContext.Provider value={{ settings, setSettings }}>
			{children}
		</SettingsContext.Provider>
	);
}

export function useSettings() {
	const context = useContext(SettingsContext);

	if (!context) {
		throw new Error("useSettings must be used inside SettingsProvider");
	}

	return context;
}
