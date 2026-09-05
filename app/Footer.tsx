import { Link } from "react-router";

const REPO_URL = "https://github.com/theveryoilydill/source-frames-template";

export function Footer() {
	return (
		<footer className="mt-auto border-t border-hairline pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
			<div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted sm:flex-row sm:px-6 lg:px-8">
				<div className="flex items-center gap-2">
					<span aria-hidden className="text-lg leading-none text-accent">
						◧
					</span>
					<span className="font-display font-semibold text-ink">Source Frames</span>
				</div>

				<p>Released under the AGPL-3.0 license.</p>

				<nav aria-label="Footer">
					<ul className="flex items-center gap-4">
						<li>
							<Link to="/" className="transition duration-150 hover:text-ink">
								Home
							</Link>
						</li>
						<li>
							<Link to="/settings" className="transition duration-150 hover:text-ink">
								Settings
							</Link>
						</li>
						<li>
							<a
								href={REPO_URL}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 transition duration-150 hover:text-ink"
							>
								GitHub
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth={1.8}
									strokeLinecap="round"
									strokeLinejoin="round"
									className="h-3.5 w-3.5"
									aria-hidden
								>
									<path d="M7 17 17 7M9 7h8v8" />
								</svg>
							</a>
						</li>
					</ul>
				</nav>
			</div>
		</footer>
	);
}

export default Footer;
