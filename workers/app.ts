import { createRequestHandler } from "react-router";

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

export default {
	async fetch(request) {
		const response = await requestHandler(request);
		const headers = new Headers(response.headers);
		// CSP Removed on purpose
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	},
} satisfies ExportedHandler<Env>;
