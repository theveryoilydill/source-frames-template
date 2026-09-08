import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import type { Route } from "./+types/settings";
import Header from "../Header";
import Footer from "../Footer";
import ErrorPanel from "../ErrorPanel";
import ImportDialog, { type ImportPreviewData, type ImportSelection } from "../ImportDialog";
import { applyTheme, readStoredChoice, type ThemeChoice } from "../theme";
import { showToast } from "../Toast";
import { readFavorites, writeFavorites } from "../data/favorites";
import {
	RECENT_EVENT,
	RECENT_LIMIT,
	clearRecent,
	readRecent,
	writeRecent,
	type RecentEntry,
} from "../data/recent";
import {
	CUSTOM_FRAMES_EVENT,
	addCustomFrame,
	deleteCustomFrame,
	readCustomFrames,
	updateCustomFrame,
	writeCustomFrames,
	type CustomFrame,
} from "../data/customFrames";
import { OPEN_COUNTS_EVENT, clearOpenCounts, readOpenCounts } from "../data/openCounts";
import { sources } from "../data/sources";

const APP_VERSION = "2.0.0";

export function meta(_args: Route.MetaArgs) {
	const title = "Settings — Source Frames";
	const description =
		"Choose your theme, add or edit custom frames, and export, import with a preview of what to bring in, or reset your locally stored Source Frames data.";
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

const KIND_OPTIONS: { value: CustomFrame["kind"]; label: string }[] = [
	{ value: "iframe", label: "Frame overlay" },
	{ value: "link", label: "New tab link" },
];

const CUSTOM_FIELD_CLASS =
	"w-full rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-accent/60 focus:outline-none focus:ring-4 focus:ring-accent/25 transition";

/** Shape of the JSON file produced by the Data section's export. */
type ExportPayload = {
	app: "source-frames";
	version: number;
	exportedAt: string;
	favorites: string[];
	recents: RecentEntry[];
	customFrames: CustomFrame[];
};

/**
 * Lenient shape check of a parsed import file: it must be an object carrying
 * at least one of the three known collections as an array. Entries are only
 * unwrapped here — the data modules validate and drop junk at write time.
 * Returns null when nothing recognizable is found.
 */
function parseImportFile(
	parsed: unknown,
): { favorites: unknown[]; recents: unknown[]; customFrames: unknown[] } | null {
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
	const record = parsed as Record<string, unknown>;
	if (
		!Array.isArray(record.favorites) &&
		!Array.isArray(record.recents) &&
		!Array.isArray(record.customFrames)
	) {
		return null;
	}
	return {
		favorites: Array.isArray(record.favorites) ? record.favorites : [],
		recents: Array.isArray(record.recents) ? record.recents : [],
		customFrames: Array.isArray(record.customFrames) ? record.customFrames : [],
	};
}

/**
 * Normalizes one imported recent entry; both "URL" (as exported) and "url"
 * spellings are accepted. Entries with no usable url/name are dropped by
 * writeRecent.
 */
function toImportedRecent(entry: unknown): RecentEntry | null {
	const record = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
	const url =
		typeof record.URL === "string" ? record.URL : typeof record.url === "string" ? record.url : "";
	const name = typeof record.name === "string" ? record.name : "";
	if (!url || !name) return null;
	return {
		URL: url,
		name,
		...(typeof record.openedAt === "number" && Number.isFinite(record.openedAt)
			? { openedAt: record.openedAt }
			: {}),
	};
}

/**
 * Mirrors the id generator in the customFrames data module: crypto.randomUUID
 * when available, with the same legacy fallback. Hand-made import files may
 * omit ids; ids present in the export format are still honored as-is.
 */
function nextImportedFrameId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}
	return `cf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Normalizes one imported custom frame with the same shape checks
 * writeCustomFrames applies, so preview counts match the import result —
 * except entries missing an id, which get one generated instead of being
 * dropped (the export format always carries ids, and those are kept).
 */
function toImportedCustomFrame(entry: unknown): CustomFrame | null {
	const record = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
	if (typeof record.name !== "string" || typeof record.URL !== "string") return null;
	if (record.kind !== undefined && record.kind !== "iframe" && record.kind !== "link") return null;
	return {
		id: typeof record.id === "string" && record.id ? record.id : nextImportedFrameId(),
		name: record.name.trim(),
		URL: record.URL.trim(),
		...(typeof record.description === "string" && record.description
			? { description: record.description }
			: {}),
		tags: Array.isArray(record.tags)
			? record.tags.filter((tag): tag is string => typeof tag === "string")
			: [],
		kind: record.kind === "link" ? "link" : "iframe",
	};
}

/** Joins count phrases for the import toast: "a and b", "a, b, and c". */
function joinNatural(parts: string[]): string {
	if (parts.length === 1) return parts[0];
	if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
	return `${parts[0]}, ${parts[1]}, and ${parts[2]}`;
}

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
	const [recentCount, setRecentCount] = useState(0);
	const [frames, setFrames] = useState<CustomFrame[]>([]);
	const [openCounts, setOpenCounts] = useState<Record<string, number>>({});
	const [showAllOpened, setShowAllOpened] = useState(false);
	const [name, setName] = useState("");
	const [url, setUrl] = useState("");
	const [description, setDescription] = useState("");
	const [tagsInput, setTagsInput] = useState("");
	const [kind, setKind] = useState<CustomFrame["kind"]>("iframe");
	const [error, setError] = useState<string | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [importPreview, setImportPreview] = useState<ImportPreviewData | null>(null);
	const importButtonRef = useRef<HTMLLabelElement>(null);

	useEffect(() => {
		setChoice(readStoredChoice());

		const readFavoritesCount = () => {
			// Use readFavorites() (the app-wide source of truth) rather than
			// reading the raw key: readFavorites() runs the one-time legacy
			// "settings" migration when the sf:favorites key is absent, so the
			// count here matches what the launcher actually shows.
			setFavoritesCount(readFavorites().length);
		};
		readFavoritesCount();

		window.addEventListener("sf:favoritesUpdated", readFavoritesCount);

		const readRecentCount = () => setRecentCount(readRecent().length);
		readRecentCount();
		window.addEventListener(RECENT_EVENT, readRecentCount);

		const syncCustomFrames = () => setFrames(readCustomFrames());
		syncCustomFrames();
		window.addEventListener(CUSTOM_FRAMES_EVENT, syncCustomFrames);

		const syncOpenCounts = () => setOpenCounts(readOpenCounts());
		syncOpenCounts();
		window.addEventListener(OPEN_COUNTS_EVENT, syncOpenCounts);

		return () => {
			window.removeEventListener("sf:favoritesUpdated", readFavoritesCount);
			window.removeEventListener(RECENT_EVENT, readRecentCount);
			window.removeEventListener(CUSTOM_FRAMES_EVENT, syncCustomFrames);
			window.removeEventListener(OPEN_COUNTS_EVENT, syncOpenCounts);
		};
	}, []);

	const customCount = frames.length;

	// "Most opened" readout: map each counted URL to a display name from the
	// built-in sources plus custom frames (counts for unknown URLs are skipped),
	// sorted count descending with ties broken by name ascending. The block
	// shows the top three until "Show all" expands the full ranked list.
	const openUrlNames = new Map<string, string>();
	for (const source of sources) openUrlNames.set(source.URL, source.name);
	for (const frame of frames) openUrlNames.set(frame.URL, frame.name);
	const rankedOpenFrames = Object.entries(openCounts)
		.map(([url, count]) => ({ url, count, name: openUrlNames.get(url) ?? "" }))
		.filter((entry) => entry.name !== "")
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
	const mostOpened = showAllOpened ? rankedOpenFrames : rankedOpenFrames.slice(0, 3);

	// Hiding the block (counts cleared) also collapses the expanded list, so a
	// fresh set of counts always starts from the top three again.
	useEffect(() => {
		if (rankedOpenFrames.length === 0) setShowAllOpened(false);
	}, [rankedOpenFrames.length]);

	const handleChoice = (next: ThemeChoice) => {
		setChoice(next);
		applyTheme(next);
	};

	const clearFavorites = () => {
		// Persist an explicit empty list (instead of removing the key): an
		// absent key is what triggers the legacy-favorites migration, and a
		// list the user deliberately cleared must never silently come back.
		setFavoritesCount(writeFavorites([]).length);
		setConfirmingClear(false);
	};

	const startEditFrame = (frame: CustomFrame) => {
		setEditingId(frame.id);
		setName(frame.name);
		setUrl(frame.URL);
		setDescription(frame.description ?? "");
		setTagsInput(frame.tags.join(", "));
		setKind(frame.kind);
		setError(null);
	};

	const cancelEditFrame = () => {
		setEditingId(null);
		setName("");
		setUrl("");
		setDescription("");
		setTagsInput("");
		setKind("iframe");
		setError(null);
	};

	/**
	 * Re-inserts a previously deleted frame at its original position. A
	 * same-URL re-add is dropped first so the restore can never leave two
	 * rows sharing one URL — the captured frame takes the original slot.
	 */
	const restoreDeletedFrame = (frame: CustomFrame, index: number) => {
		const current = readCustomFrames();
		const withoutUrl = current.filter((entry) => entry.URL !== frame.URL);
		withoutUrl.splice(Math.min(index, withoutUrl.length), 0, frame);
		setFrames(writeCustomFrames(withoutUrl));
		showToast(`Restored ${frame.name}`, "success");
	};

	const handleDeleteFrame = (id: string) => {
		const index = frames.findIndex((entry) => entry.id === id);
		if (index === -1) return;
		const frame = frames[index];
		const next = deleteCustomFrame(id);
		// deleteCustomFrame returns the list unchanged when the id was not
		// found (e.g. cleared in another tab), so a length check detects the
		// no-op instead of searching for the id (always absent after a
		// successful delete or a no-op alike).
		if (next.length === frames.length) return; // storage no-op — nothing was deleted
		setFrames(next);
		// Deleting the row currently being edited exits edit mode.
		if (editingId === id) cancelEditFrame();
		showToast(`Deleted "${frame.name}"`, "info", {
			label: "Undo",
			onClick: () => restoreDeletedFrame(frame, index),
		});
	};

	const handleFrameSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const tags = tagsInput
			.split(",")
			.map((tag) => tag.trim())
			.filter(Boolean)
			.filter((tag, index, all) => all.indexOf(tag) === index);
		const trimmedDescription = description.trim();
		if (editingId) {
			const trimmedName = name.trim();
			const trimmedUrl = url.trim();
			if (!trimmedName || !/^https?:\/\//i.test(trimmedUrl)) {
				setError("Enter a name and an http(s) URL.");
				return;
			}
			if (!frames.some((entry) => entry.id === editingId)) {
				// The frame vanished (e.g. cleared in another tab) — leave edit mode.
				cancelEditFrame();
				return;
			}
			const updated = updateCustomFrame(editingId, {
				name,
				URL: url,
				description: trimmedDescription || null,
				tags,
				kind,
			});
			const saved = updated.find((entry) => entry.id === editingId);
			setFrames(updated);
			showToast(`Updated ${saved?.name ?? trimmedName}`, "success");
			cancelEditFrame();
			return;
		}
		const previous = frames;
		const next = addCustomFrame({
			name,
			URL: url,
			...(trimmedDescription ? { description: trimmedDescription } : {}),
			tags,
			kind,
		});
		// Replacing an existing URL keeps the list length, so a rejected add is
		// detected as "returned list unchanged" rather than by length alone.
		if (JSON.stringify(next) === JSON.stringify(previous)) {
			setError("Enter a name and an http(s) URL.");
			return;
		}
		setFrames(next);
		setError(null);
		setName("");
		setUrl("");
		setDescription("");
		setTagsInput("");
	};

	const handleExport = () => {
		try {
			const payload: ExportPayload = {
				app: "source-frames",
				version: 1,
				exportedAt: new Date().toISOString(),
				favorites: readFavorites(),
				recents: readRecent(),
				customFrames: readCustomFrames(),
			};
			const blob = new Blob([JSON.stringify(payload, null, "\t")], { type: "application/json" });
			const objectUrl = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = objectUrl;
			anchor.download = "source-frames-data.json";
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
			showToast("Data exported", "success");
		} catch {
			showToast("Data could not be exported.", "error");
		}
	};

	const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		// Reset so picking the same file again still fires change.
		event.target.value = "";
		if (!file) return;

		let parsed: unknown;
		try {
			parsed = JSON.parse(await file.text());
		} catch {
			showToast("That file could not be read as Source Frames data.", "error");
			return;
		}
		const imported = parseImportFile(parsed);
		if (!imported) {
			showToast("No Source Frames data found in that file.", "error");
			return;
		}

		// Validate exactly what each write would keep, so the preview counts
		// match the import result: junk entries are dropped here, not at write
		// time. Custom frames without an id (hand-made files) get one generated;
		// ids present in the export format are still honored.
		const favorites = [
			...new Set(imported.favorites.filter((url): url is string => typeof url === "string")),
		];
		const recents: RecentEntry[] = [];
		const seenUrls = new Set<string>();
		for (const entry of imported.recents.map(toImportedRecent)) {
			if (!entry || seenUrls.has(entry.URL)) continue;
			seenUrls.add(entry.URL);
			recents.push(entry);
			if (recents.length === RECENT_LIMIT) break;
		}
		const customFrames = imported.customFrames
			.map(toImportedCustomFrame)
			.filter((frame): frame is CustomFrame => frame !== null);

		// Nothing importable — the dialog stays closed and the miss is reported.
		if (favorites.length === 0 && recents.length === 0 && customFrames.length === 0) {
			showToast("No Source Frames data found in that file.", "error");
			return;
		}

		const record = parsed as Record<string, unknown>;
		setImportPreview({
			fileName: file.name,
			exportedAt: typeof record.exportedAt === "string" ? record.exportedAt : null,
			favorites,
			recents,
			customFrames,
		});
	};

	/** Every dialog close path (confirm, cancel, Escape, backdrop) refocuses the trigger. */
	const closeImportDialog = () => {
		setImportPreview(null);
		importButtonRef.current?.focus();
	};

	const handleImportConfirm = (selection: ImportSelection) => {
		const preview = importPreview;
		if (!preview) return;
		const parts: string[] = [];
		if (selection.favorites) {
			const count = writeFavorites(preview.favorites).length;
			parts.push(`${count} ${count === 1 ? "favorite" : "favorites"}`);
		}
		if (selection.recents) {
			const count = writeRecent(preview.recents).length;
			parts.push(`${count} ${count === 1 ? "recent frame" : "recent frames"}`);
		}
		if (selection.customFrames) {
			const count = writeCustomFrames(preview.customFrames).length;
			parts.push(`${count} ${count === 1 ? "custom frame" : "custom frames"}`);
		}
		if (parts.length > 0) showToast(`Imported ${joinNatural(parts)}`, "success");
		closeImportDialog();
	};

	const handleResetAll = () => {
		if (
			!window.confirm(
				"Clear all favorites, recents, custom frames, and open counts stored on this device?",
			)
		) {
			return;
		}
		writeFavorites([]);
		writeRecent([]);
		writeCustomFrames([]);
		clearOpenCounts();
		// Reset also disarms the edit form so it returns to "Add frame".
		cancelEditFrame();
		showToast("All local data cleared", "success");
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

					<div className="mt-6 border-t border-hairline pt-5">
						<p className="text-sm text-muted" role="status">
							{recentCount} {recentCount === 1 ? "recent frame" : "recent frames"} kept for quick
							access.
						</p>
						<div className="mt-3">
							<button
								type="button"
								onClick={() => setRecentCount(clearRecent().length)}
								disabled={recentCount === 0}
								className="rounded-lg border border-hairline px-3.5 py-2 text-sm font-medium text-muted transition duration-150 hover:bg-raised hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
							>
								Clear recents
							</button>
						</div>
					</div>

					{mostOpened.length > 0 && (
						<div className="mt-6 border-t border-hairline pt-5">
							<h3 className="text-sm font-semibold text-ink">Most opened</h3>
							<p className="mt-1 text-xs text-muted">Your top frames by opens on this device.</p>
							<ol className="mt-3 space-y-1.5">
								{mostOpened.map((entry, index) => (
									<li key={entry.url} className="flex items-center gap-3">
										<span className="w-4 shrink-0 text-right text-xs text-muted">{index + 1}</span>
										<span className="min-w-0 truncate text-sm font-medium text-ink">
											{entry.name}
										</span>
										<span className="ml-auto shrink-0 text-sm text-muted tabular-nums">
											{entry.count}×
										</span>
									</li>
								))}
							</ol>
							{rankedOpenFrames.length > 3 && (
								<button
									type="button"
									onClick={() => setShowAllOpened((current) => !current)}
									aria-expanded={showAllOpened}
									className="mt-2 text-xs text-muted transition duration-150 hover:text-ink active:scale-[0.98]"
								>
									{showAllOpened ? "Show less" : `Show all ${rankedOpenFrames.length}`}
								</button>
							)}
						</div>
					)}

					<div className="mt-6 border-t border-hairline pt-5">
						<p className="text-sm text-muted">
							Export bundles favorites, recents, and custom frames as JSON on this device; importing
							a file previews it so you can choose which collections to bring in.
						</p>
						<div className="mt-3 flex flex-wrap items-center gap-2.5">
							<button
								type="button"
								onClick={handleExport}
								className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white transition duration-150 hover:opacity-90 active:scale-[0.98]"
							>
								Export data
							</button>
							<label
								ref={importButtonRef}
								tabIndex={-1}
								className="cursor-pointer rounded-lg border border-hairline px-3.5 py-2 text-sm font-medium text-muted transition duration-150 hover:bg-raised hover:text-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
							>
								Import data
								<input
									type="file"
									accept="application/json,.json"
									onChange={handleImportChange}
									className="sr-only"
								/>
							</label>
						</div>
					</div>

					<div className="mt-6 border-t border-hairline pt-5">
						<p className="text-sm text-muted">
							Resetting clears favorites, recents, custom frames, and open counts from this browser.
							This cannot be undone.
						</p>
						<div className="mt-3">
							<button
								type="button"
								onClick={handleResetAll}
								className="rounded-lg border border-red-500/40 px-3.5 py-2 text-sm font-medium text-red-600 transition duration-150 hover:bg-red-50 active:scale-[0.98] dark:text-red-500 dark:hover:bg-red-950/30"
							>
								Reset all data
							</button>
						</div>
					</div>
				</section>

				<section
					aria-labelledby="custom-frames-heading"
					className="mt-4 rounded-xl border border-hairline bg-surface p-6"
				>
					<h2 id="custom-frames-heading" className="font-display text-lg font-semibold text-ink">
						Custom frames
					</h2>
					<p className="mt-1 text-sm text-muted">
						Add your own frames. They live in this browser and appear in the launcher alongside the
						built-ins.
					</p>
					<p className="mt-4 text-sm text-muted" role="status">
						{customCount} {customCount === 1 ? "custom frame" : "custom frames"} saved on this
						device.
					</p>

					{frames.length > 0 ? (
						<div className="mt-4 divide-y divide-hairline rounded-lg border border-hairline bg-page/50 px-4">
							{frames.map((frame) => (
								<div
									key={frame.id}
									className={`flex items-center gap-3 py-2.5${editingId === frame.id ? " bg-accent/5" : ""}`}
								>
									<span className="min-w-0 truncate text-sm font-medium text-ink">
										{frame.name}
									</span>
									<span className="shrink-0 rounded-full border border-hairline bg-raised px-2 py-0.5 text-[10px] text-muted">
										{frame.kind === "link" ? "Link" : "Frame"}
									</span>
									{frame.tags.length > 0 && (
										<span className="hidden min-w-0 truncate text-xs text-muted sm:block">
											{frame.tags.join(", ")}
										</span>
									)}
									<button
										type="button"
										onClick={() => startEditFrame(frame)}
										className="ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition duration-150 hover:bg-raised hover:text-ink active:scale-90"
										aria-label={`Edit ${frame.name}`}
										title="Edit"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth={2}
											strokeLinecap="round"
											strokeLinejoin="round"
											className="h-3.5 w-3.5"
											aria-hidden
										>
											<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
										</svg>
									</button>
									<button
										type="button"
										onClick={() => handleDeleteFrame(frame.id)}
										className="shrink-0 text-sm text-red-600 hover:underline dark:text-red-500"
										aria-label={`Delete ${frame.name}`}
									>
										Delete
									</button>
								</div>
							))}
						</div>
					) : (
						<p className="mt-4 text-sm text-muted">Nothing added yet.</p>
					)}

					<form
						onSubmit={handleFrameSubmit}
						className="mt-5 space-y-3 border-t border-hairline pt-5"
					>
						<h3 className="text-sm font-semibold text-ink">
							{editingId ? "Edit frame" : "Add frame"}
						</h3>
						<div>
							<label
								htmlFor="custom-frame-name"
								className="mb-1.5 block text-xs font-medium text-muted"
							>
								Name
							</label>
							<input
								id="custom-frame-name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								placeholder="My frame"
								className={CUSTOM_FIELD_CLASS}
							/>
						</div>
						<div>
							<label
								htmlFor="custom-frame-url"
								className="mb-1.5 block text-xs font-medium text-muted"
							>
								URL
							</label>
							<input
								id="custom-frame-url"
								type="url"
								value={url}
								onChange={(event) => setUrl(event.target.value)}
								placeholder="https://example.com"
								className={CUSTOM_FIELD_CLASS}
							/>
						</div>
						<div>
							<label
								htmlFor="custom-frame-description"
								className="mb-1.5 block text-xs font-medium text-muted"
							>
								Description
							</label>
							<input
								id="custom-frame-description"
								value={description}
								onChange={(event) => setDescription(event.target.value)}
								placeholder="What is it for? (optional)"
								className={CUSTOM_FIELD_CLASS}
							/>
						</div>
						<div>
							<label
								htmlFor="custom-frame-tags"
								className="mb-1.5 block text-xs font-medium text-muted"
							>
								Tags
							</label>
							<input
								id="custom-frame-tags"
								value={tagsInput}
								onChange={(event) => setTagsInput(event.target.value)}
								placeholder="research, daily (comma separated, optional)"
								className={CUSTOM_FIELD_CLASS}
							/>
						</div>
						<fieldset>
							<legend className="sr-only">Kind</legend>
							<div className="flex flex-wrap gap-2">
								{KIND_OPTIONS.map((option) => {
									const active = kind === option.value;
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
												name="custom-frame-kind"
												value={option.value}
												checked={active}
												onChange={() => setKind(option.value)}
												className="sr-only"
											/>
											{option.label}
										</label>
									);
								})}
							</div>
						</fieldset>
						<div className="flex flex-wrap items-center gap-3">
							<button
								type="submit"
								className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white transition duration-150 hover:opacity-90 active:scale-[0.98]"
							>
								{editingId ? "Save changes" : "Add frame"}
							</button>
							{editingId && (
								<button
									type="button"
									onClick={cancelEditFrame}
									className="rounded-lg border border-hairline px-3.5 py-2 text-sm font-medium text-muted transition duration-150 hover:bg-raised hover:text-ink"
								>
									Cancel
								</button>
							)}
							{error && (
								<p className="text-sm text-red-600 dark:text-red-500" role="alert">
									{error}
								</p>
							)}
						</div>
					</form>
					<p className="mt-3 text-xs text-muted">
						Tip: some sites refuse to be embedded — use a link kind for those.
					</p>
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
					</div>
					<p className="mt-3 text-sm text-muted">
						Source Frames runs entirely in your browser. Favorites, recents, open counts, custom
						frames, and theme preferences are stored locally on this device. Existing custom frames
						can be edited from the list above, and the Data section can export them as a JSON file
						or import one after previewing exactly what changes — or reset all local data in one
						step.
					</p>
				</section>
			</main>

			{importPreview && (
				<ImportDialog
					preview={importPreview}
					onClose={closeImportDialog}
					onConfirm={handleImportConfirm}
				/>
			)}

			<Footer />
		</div>
	);
}
