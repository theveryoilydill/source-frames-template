import type { Config } from "@react-router/dev/config";

export default {
	// Config options...
	ssr: true,
	splitRouteModules: true,
	prerender: ["/", "/settings"],
	future: {

	},
} satisfies Config;
