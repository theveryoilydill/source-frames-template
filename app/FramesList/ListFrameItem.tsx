export type SourceData = {
	name: string;
	URL: string;
	description?: string;
	category?: string;
};

function getHostname(sourceUrl: string) {
	try {
		return new URL(sourceUrl).hostname.replace(/^www\./, "");
	} catch {
		return sourceUrl;
	}
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
		<article className="group flex h-full flex-col justify-between rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-500/70">
			<div className="space-y-4">
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
					<p className="text-sm leading-6 text-gray-600 dark:text-gray-400">{source.description}</p>
				) : null}
			</div>

			<div className="mt-6 flex items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
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
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="currentColor"
								className="h-5 w-5 text-red-500"
							>
								<path d="M11.645 20.91l-.007-.003-.007.003C5.6 19.36 2 15.28 2 11.08 2 8.06 4.42 6 7.22 6c1.6 0 3.04.8 3.78 2.01A4.56 4.56 0 0 1 14.78 6c2.8 0 5.22 2.06 5.22 5.08 0 4.2-3.6 8.28-9.355 9.83z" />
							</svg>
						) : (
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								strokeWidth={1.5}
								stroke="currentColor"
								className="h-5 w-5"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M21 8.25c0 3.03-2.69 6.19-8.01 9.75L12 19.5l-0.99-1.5C5.69 14.44 3 11.28 3 8.25 3 5.28 5.28 3 8.25 3c1.7 0 3.23.86 4.05 2.16A4.26 4.26 0 0 1 16.75 3C19.72 3 22 5.28 22 8.25z"
								/>
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
