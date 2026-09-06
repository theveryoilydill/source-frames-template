import { Link } from "react-router";

/**
 * Shared styled full-page error panel used by the root and route
 * ErrorBoundaries. Renders inside the root Layout, so tokens/fonts apply.
 */
export function ErrorPanel({
	code,
	title,
	details,
	stack,
}: {
	code: string;
	title: string;
	details: string;
	stack?: string;
}) {
	return (
		<main className="flex min-h-dvh items-center justify-center px-4 py-16">
			<section
				aria-labelledby="error-title"
				className="w-full max-w-lg rounded-xl border border-hairline bg-surface p-8 text-center sm:p-10"
			>
				<span aria-hidden className="text-3xl leading-none text-accent">
					◧
				</span>
				<p className="mt-6 font-display text-6xl font-bold tracking-tight text-ink">{code}</p>
				<h1 id="error-title" className="mt-3 font-display text-xl font-semibold text-ink">
					{title}
				</h1>
				<p className="mt-2 text-sm text-muted">{details}</p>
				{stack ? (
					<pre className="mt-6 max-h-56 overflow-auto rounded-lg border border-hairline bg-page p-4 text-left font-mono text-xs leading-5 text-muted">
						<code>{stack}</code>
					</pre>
				) : null}
				<div className="mt-8">
					<Link
						to="/"
						className="bg-accent inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:opacity-90"
					>
						Back to console
					</Link>
				</div>
			</section>
		</main>
	);
}

export default ErrorPanel;
