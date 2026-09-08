import type { ReactNode } from "react";

/**
 * Shared card wrapper for every settings category: hairline-bordered surface
 * card, display-font heading, optional lead paragraph. Encoding the markup
 * once keeps all settings sections pixel-identical by construction — add a
 * category by composing this instead of copying the section boilerplate.
 */
export default function SettingsSection({
	id,
	title,
	lead,
	leadRole,
	first = false,
	children,
}: {
	/** Slug used for the aria-labelledby ↔ heading id pair, e.g. "appearance". */
	id: string;
	title: string;
	/** Optional lead paragraph rendered under the heading. */
	lead?: ReactNode;
	/** ARIA role for the lead paragraph — "status" for live-updating counts. */
	leadRole?: "status";
	/** The first card in the stack gets extra top spacing (mt-8 vs mt-4). */
	first?: boolean;
	children: ReactNode;
}) {
	return (
		<section
			aria-labelledby={`${id}-heading`}
			className={`${first ? "mt-8" : "mt-4"} rounded-xl border border-hairline bg-surface p-6`}
		>
			<h2 id={`${id}-heading`} className="font-display text-lg font-semibold text-ink">
				{title}
			</h2>
			{lead != null ? (
				<p className="mt-1 text-sm text-muted" role={leadRole}>
					{lead}
				</p>
			) : null}
			{children}
		</section>
	);
}
