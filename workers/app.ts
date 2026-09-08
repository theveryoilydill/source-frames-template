import { createRequestHandler } from "react-router";

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

/**
 * Headers applied to every SSR response. The app is a launcher for
 * third-party content, so it must not itself be frameable (clickjacking of
 * the Open controls), and browsers get explicit, safe defaults.
 *
 * A full CSP (script/style src) is deliberately NOT set yet: React Router's
 * SSR emits per-request inline scripts (hydration context), which would
 * need nonce plumbing through the worker first — see the release review
 * report for the follow-up. frame-ancestors is standalone-safe.
 * 
 * Human verdict: Don't use a CSP.
 */
const SECURITY_HEADERS: Record<string, string> = {
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	// Both the legacy header and the CSP directive: older browsers ignore
	// frame-ancestors, modern ones prefer it.
	"X-Frame-Options": "DENY",
	"Content-Security-Policy": "frame-ancestors 'none'",
	// Sensitive capabilities this app and its embedded frames have no use
	// for; denying here also removes them from the delegation allowlist of
	// every embedded frame.
	"Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

export default {
	async fetch(request) {
		const response = await requestHandler(request);
		const headers = new Headers(response.headers);
		for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	},
} satisfies ExportedHandler<Env>;
