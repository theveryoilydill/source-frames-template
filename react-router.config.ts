import type { Config } from "@react-router/dev/config";

export default {
	// Config options...
	ssr: true,
	prerender: ["/", "/settings"],
	splitRouteModules: true,
} satisfies Config;
