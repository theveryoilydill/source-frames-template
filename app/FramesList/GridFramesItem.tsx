import { useState, useRef, useCallback } from "react";

export type SourceData = {
	name: string;
	URL: string;
	description?: string;
	category?: string;
	previewImage?: string;
	previewVideo?: string | string[];
};

function getHostname(sourceUrl: string) {
	try {
		return new URL(sourceUrl).hostname.replace(/^www\./, "");
	} catch {
		return sourceUrl;
	}
}

function getFileExtension(sourceUrl: string) {
	try {
		return new URL(sourceUrl, "http://localhost").pathname.split(".").pop()?.toLowerCase();
	} catch {
		return sourceUrl.split("?")[0]?.split("#")[0]?.split(".").pop()?.toLowerCase();
	}
}

function getVideoType(sourceUrl: string) {
	switch (getFileExtension(sourceUrl)) {
		case "mp4":
			return "video/mp4";
		default:
			return undefined;
	}
}

function PreviewMedia({
	previewImage,
	previewVideo,
}: {
	previewImage?: string;
	previewVideo?: string | string[];
}) {
	const previewVideos = Array.isArray(previewVideo)
		? previewVideo
		: previewVideo
			? [previewVideo]
			: [];
	const gifPreview = previewVideos.find((sourceUrl) => getFileExtension(sourceUrl) === "gif");
	const videoPreviews = previewVideos.filter((sourceUrl) => getFileExtension(sourceUrl) !== "gif");
	const [isAnimatedPreviewReady, setIsAnimatedPreviewReady] = useState(!previewImage);
	const posterClassName = isAnimatedPreviewReady
		? "relative z-10 h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-0 group-focus-within:opacity-0"
		: "relative z-10 h-full w-full object-cover";
	const videoRef = useRef<HTMLVideoElement | null>(null);

	const playPreview = useCallback(() => {
		const v = videoRef.current;
		if (!v) return;
		// Attempt to play; ignore promise rejections (e.g., not ready)
		const p = v.play();
		if (p && typeof p.then === "function") p.catch(() => {});
	}, []);

	const pausePreview = useCallback(() => {
		const v = videoRef.current;
		if (!v) return;
		try {
			v.pause();
			v.currentTime = 0;
		} catch {
			/* ignore */
		}
	}, []);

	if (!previewImage && !previewVideos.length) return null;

	return (
		<div
			className="relative aspect-video overflow-hidden bg-gray-100 dark:bg-gray-800"
			onMouseEnter={playPreview}
			onMouseLeave={pausePreview}
			onFocus={playPreview}
			onBlur={pausePreview}
			onPointerEnter={playPreview}
			onPointerLeave={pausePreview}
			tabIndex={0}
		>
			{videoPreviews.length ? (
				<video
					ref={videoRef}
					className="absolute inset-0 h-full w-full object-cover"
					poster={previewImage}
					muted
					loop
					playsInline
					preload="metadata"
					aria-hidden="true"
					onCanPlay={() => setIsAnimatedPreviewReady(true)}
				>
					{videoPreviews.map((sourceUrl) => (
						<source key={sourceUrl} src={sourceUrl} type={getVideoType(sourceUrl)} />
					))}
				</video>
			) : gifPreview ? (
				<img
					src={gifPreview}
					alt=""
					className="absolute inset-0 h-full w-full object-cover"
					aria-hidden="true"
					onLoad={() => setIsAnimatedPreviewReady(true)}
				/>
			) : null}

			{previewImage ? <img src={previewImage} alt="" className={posterClassName} /> : null}
		</div>
	);
}

export function FrameItem({
	source,
	isFavorite = false,
	onToggleFavorite,
	onOpen,
}: {
	source: SourceData;
	isFavorite?: boolean;
	onToggleFavorite?: (url: string) => void;
	onOpen?: (url: string, title?: string) => void;
}) {
	const hostname = getHostname(source.URL);

	return (
		<article className="group flex h-full flex-col justify-between overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-within:border-blue-300 focus-within:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-500/70 dark:focus-within:border-blue-500/70">
			<div>
				<PreviewMedia previewImage={source.previewImage} previewVideo={source.previewVideo} />

				<div className="space-y-4 p-5">
					<div className="flex items-start justify-between gap-4">
						<div className="min-w-0">
							<p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600 dark:text-blue-400">
								{source.category ?? "Source"}
							</p>
							<h2 className="mt-2 text-xl font-semibold leading-tight text-gray-950 dark:text-white">
								{source.name}
							</h2>
						</div>
						<span className="shrink-0 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 dark:border-gray-700 dark:text-gray-300">
							Frame
						</span>
					</div>

					{source.description ? (
						<p className="text-sm leading-6 text-gray-600 dark:text-gray-400">
							{source.description}
						</p>
					) : null}
				</div>
			</div>

			<div className="mx-5 mb-5 flex items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
				<div className="flex items-center gap-3">
					<span className="min-w-0 truncate text-sm text-gray-500 dark:text-gray-400">
						{hostname}
					</span>
				</div>

				<div className="flex items-center gap-2">
					<button
						type="button"
						aria-pressed={isFavorite}
						aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
						onClick={() => onToggleFavorite?.(source.URL)}
						className="inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-300"
					>
						{isFavorite ? (
							// Filled
							// Had to put a direct svg here because the svg doesn't work for some reason and there is fill colors
							// I temporarily hardcoded red for the heart color, but if we add themes we should change.
							<svg xmlns="http://www.w3.org/2000/svg" fill="red" viewBox="0 0 24 24" stroke-width="1.5" stroke="red" className="size-6">
								<path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
							</svg>
						) : (
							// Unfilled
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-6">
								<path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
							</svg>
						)}
					</button>

					<button
						type="button"
						onClick={() => onOpen?.(source.URL, source.name)}
						className="inline-flex shrink-0 items-center rounded-md bg-gray-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-white dark:text-gray-950 dark:hover:bg-blue-200 dark:focus:ring-offset-gray-900"
					>
						Open
						<span className="ml-1" aria-hidden="true">
							-&gt;
						</span>
					</button>
				</div>
			</div>
		</article>
	);
}
