import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	base: "./", // IMPORTANT for Github Pages because it looks at the base of your pages (e.g., https://username.github.io/) to find stuff from index.html.
	plugins: [tailwindcss(), reactRouter()],
	resolve: {
		tsconfigPaths: true,
	},
});
