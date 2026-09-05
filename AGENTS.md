## Purpose

Short, actionable instructions for AI coding agents working in this repository. For project overview and deployment see [README.md](README.md).

## Commands

The repo pins `packageManager` (pnpm 11.6.0). Bare `pnpm` may not be on PATH — use corepack. In sandboxed/CI environments, prefix with `CI=true WRANGLER_SEND_METRICS=false` (skips wrangler metrics/telemetry and interactive prompts):

| Task                   | Command                                         |
| ---------------------- | ----------------------------------------------- |
| Install                | `corepack pnpm install`                         |
| Dev server             | `corepack pnpm dev` (http://localhost:5173)     |
| Build                  | `corepack pnpm build`                           |
| Preview (prod-like)    | `corepack pnpm preview`                         |
| Typecheck              | `corepack pnpm run typecheck`                   |
| Lint                   | `corepack pnpm lint`                            |
| Format / verify format | `corepack pnpm fmt` / `corepack pnpm fmt:check` |
| Deploy (Cloudflare)    | `corepack pnpm run deploy`                      |

There is **no `start` script** — do not use `react-router-serve`. The Cloudflare build is a workerd module, not a Node server. Use `vite preview` (`pnpm preview`) or `wrangler dev` instead.

## Layout

- `app/routes.ts` — config-based route definitions; route modules in `app/routes/*.tsx`
- UI components in `app/`: `Header.tsx`, `FramesList/`, `FrameContent/`
- Launcher data: the `sources` array in `app/data/sources.ts`
- Worker entry: `workers/app.ts` (Cloudflare Worker serves the built app)
- Styling: Tailwind CSS v4 utilities + theme tokens in `app/app.css` (CSS-first — no `tailwind.config` file)
- Typed route helpers are generated per route: import them from `"./+types/<route>"`

## Conventions

- Indentation: tabs (4-wide); formatting is enforced by oxfmt (`pnpm fmt:check` must pass)
- Linting is enforced by oxlint; `eslint/no-unused-vars` is an error (the `correctness` category is warn)
- Before finishing any task, run: `pnpm run typecheck`, `pnpm lint`, `pnpm fmt:check`
- Never edit generated files by hand: `worker-configuration.d.ts` (`wrangler types`), `.react-router/` (`react-router typegen`), `build/`
- Don't track local/generated artifacts — `.gitignore` already covers them (`.wrangler/`, `*.tsbuildinfo`, `build/`, …)

## License

AGPL-3.0 (see [LICENSE](LICENSE))
