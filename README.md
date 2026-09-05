# Source Frames

A [React Router 7](https://reactrouter.com/) framework-mode starter for a link/frame launcher: a customizable array of "frames" (sources) that open in an in-app sandboxed iframe overlay — or as direct links — with search, category filter chips, and localStorage favorites.

## Stack

- React 19 + React Router 7.17 (framework mode, browser-history routing — not a hash router)
- Vite 8 + `@cloudflare/vite-plugin` (workerd output)
- Tailwind CSS v4 (CSS-first config in `app/app.css` — no `tailwind.config` file)
- TypeScript, oxlint + oxfmt
- Cloudflare Workers + wrangler (the app is served by the Worker in `workers/app.ts`)

Routing uses `ssr: true` and prerenders `/` and `/settings` to static HTML. The Worker serves those pages and handles everything else with SSR fallback. Hosting `build/client/` elsewhere as pure static files loses that fallback (only the two prerendered paths work).

## Getting started

Requires Node >= 20 and pnpm (the repo pins `packageManager`, so use corepack):

```sh
corepack pnpm install
corepack pnpm dev        # http://localhost:5173
corepack pnpm build
corepack pnpm preview    # builds, then runs `vite preview`
corepack pnpm typecheck  # wrangler types && react-router typegen && tsc -b
corepack pnpm lint       # oxlint
corepack pnpm fmt        # oxfmt (use fmt:check to verify only)
corepack pnpm run deploy # Cloudflare Workers: react-router build && wrangler deploy
```

There is no `start` script: the Cloudflare build is a workerd module, not a Node server, so `react-router-serve` does not apply. For a production-like local run use `pnpm preview` or `wrangler dev`.

## Customizing frames

Add or edit entries in the `sources` array in `app/data/sources.ts`:

```ts
type SourceData = {
	name: string;
	URL: string;
	description?: string;
	category?: string;
	kind?: "iframe" | "link";
};
```

`kind: "link"` opens the source in a new tab; the default opens it in the in-app iframe overlay. Many sites send `X-Frame-Options` / CSP `frame-ancestors` and refuse to be iframed — use `kind: "link"` for those.

## Deployment

- **Cloudflare Workers (primary):** `pnpm run deploy`. The Vite plugin writes the real assets config (pointing at `build/client`) into `build/server/wrangler.json` at build time, so `wrangler.jsonc` needs no manual `assets` block.
- **GitHub Pages:** a workflow is included (`.github/workflows/deploy.yml`), but Pages project sites serve under `/<repo>/` — absolute asset paths need a base path (vite `base` + React Router `basename`), so it only works at a custom domain/root by default.
- **Other static hosts:** previously this README recommended Vercel or Netlify; they work, but the Worker's SSR fallback is lost — only the prerendered `/` and `/settings` are fully functional.

## CI notes

- The Check-Lint-Format workflow runs lint, format check, typecheck, and build without failing fast, so you get everything that needs fixing in one run. The build step adds CI minutes; remove it if you're watching the budget.

## License

[AGPL-3.0](LICENSE)
