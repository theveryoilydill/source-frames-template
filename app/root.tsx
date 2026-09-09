import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
} from "react-router";
import type { ReactNode } from "react";

import type { Route } from "./+types/root";
import ErrorPanel from "./ErrorPanel";
import ToastRegion from "./Toast";
import "./app.css";

export const links: Route.LinksFunction = () => [
	{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
	{ rel: "alternate icon", href: "/favicon.ico" },
	{ rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
	{ rel: "manifest", href: "/manifest.webmanifest" },
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{
		rel: "preconnect",
		href: "https://fonts.gstatic.com",
		crossOrigin: "anonymous",
	},
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Space+Grotesk:wght@600;700&display=swap",
	},
];

/**
 * Theme bootstrap — runs before first paint (no FOUC).
 * Reads "sf:theme" ("light" | "dark" | absent = follow the system), toggles
 * the `dark` class on <html>, and sets style.colorScheme accordingly.
 */
const themeInitScript = `(function(){try{var t=localStorage.getItem("sf:theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

export function Layout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
				<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f6f7fb" />
				<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b0e14" />
				<script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
				<Meta />
				<Links />
			</head>
			<body className="bg-page font-sans text-ink antialiased">
				{/* Skip link: first focusable on every route; lands on <main id="main">. */}
				<a
					href="#main"
					className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[10001] focus:rounded-lg focus:border focus:border-hairline focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-lg"
				>
					Skip to content
				</a>
				{children}
				<ToastRegion />
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let code = "ERR";
	let title = "Something went wrong";
	let details = "An unexpected error occurred.";
	let stack: string | undefined;

	if (isRouteErrorResponse(error)) {
		code = String(error.status);
		title = error.status === 404 ? "Page not found" : "Request failed";
		details =
			error.status === 404
				? "Nothing lives at this address. Check the URL, or return to the console."
				: error.statusText || details;
	} else if (import.meta.env.DEV && error && error instanceof Error) {
		details = error.message;
		stack = error.stack;
	}

	return <ErrorPanel code={code} title={title} details={details} stack={stack} />;
}
