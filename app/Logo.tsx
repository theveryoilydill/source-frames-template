/**
 * Source Frames logo mark — the app's viewfinder identity as a glyph:
 * four rounded corner brackets framing a "half-exposed" inner frame
 * (solid left half, faded right half). currentColor only, so the parent
 * tints it (text-accent etc.). Decorative by default — the brand name
 * is always rendered as adjacent text.
 */
export function Logo({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 32 32"
			fill="none"
			aria-hidden
			className={className}
		>
			{/* Viewfinder corner brackets. */}
			<g stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
				<path d="M4 11V7a3 3 0 0 1 3-3h4" />
				<path d="M21 4h4a3 3 0 0 1 3 3v4" />
				<path d="M28 21v4a3 3 0 0 1-3 3h-4" />
				<path d="M11 28H7a3 3 0 0 1-3-3v-4" />
			</g>
			{/* Inner frame, half-exposed. */}
			<path d="M16 10h-4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4Z" fill="currentColor" />
			<path d="M16 10h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4Z" fill="currentColor" opacity={0.45} />
		</svg>
	);
}

export default Logo;
