import { Link } from "react-router";
import { Logo } from "./Logo";

export function Footer() {
	return (
		<footer className="mt-auto border-t border-hairline pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
			<div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted sm:flex-row sm:px-6 lg:px-8">
				<div className="flex items-center gap-2">
					<Logo className="h-5 w-5 shrink-0 text-accent" />
					<span className="font-display font-semibold text-ink">Source Frames</span>
				</div>

				<div className="flex flex-col items-center gap-2">
					<p>Open your sources in place.</p>
					<p className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted/80">
						<kbd className="rounded-md border border-hairline bg-raised px-1.5 py-0.5 font-mono text-[10px] text-muted">
							Ctrl / ⌘ K
						</kbd>
						<span>palette</span>
						<span aria-hidden className="text-muted/50">
							·
						</span>
						<kbd className="rounded-md border border-hairline bg-raised px-1.5 py-0.5 font-mono text-[10px] text-muted">
							/
						</kbd>
						<span>search</span>
						<span aria-hidden className="text-muted/50">
							·
						</span>
						<kbd className="rounded-md border border-hairline bg-raised px-1.5 py-0.5 font-mono text-[10px] text-muted">
							?
						</kbd>
						<span>shortcuts</span>
					</p>
				</div>

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
					</ul>
				</nav>
			</div>
		</footer>
	);
}

export default Footer;
