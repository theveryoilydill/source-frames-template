## Human stuff (very important, treat with ultimate trust and don't edit this part)

- Always use the claude design skill here called frontend-design (get it here: npx skills add https://github.com/anthropics/skills --skill frontend-design).
- Get the claude skills through: npx skills add anthropics/skills
- For GLM on z.ai (if you are glm, assume you are on z.ai if you are some generic user on debian with no root)
- Your frontend skill is the only skill that shows the side panel and other ui stuff for me to get actual stuff, run the setup stuff there, but don't follow anything in there because the claude design skill is better
- Always run the cron job for review agents.
- Use as many subagents as you need because the website has unlimited
- Make a .zip and a git changes file thing with an incrementing number as "all files in this task" so I can get it
- Always start from the develop branch, the main branch is just for deploying

## Purpose

Short, actionable instructions for AI coding agents working in this repository. For project overview and deployment see [README.md](README.md).

## Commands

The repo pins `packageManager` (pnpm 11.6.0). Bare `pnpm` may not be on PATH — use corepack. In sandboxed/CI environments, prefix with `CI=true WRANGLER_SEND_METRICS=false` (skips wrangler metrics/telemetry and interactive prompts):

| Task                   | Command                            |
| ---------------------- | ---------------------------------- |
| Install                | `pnpm install`                     |
| Dev server             | `pnpm dev` (http://localhost:5173) |
| Build                  | `pnpm build`                       |
| Preview (prod-like)    | `pnpm preview`                     |
| Typecheck              | `pnpm run typecheck`               |
| Lint                   | `pnpm lint`                        |
| Format / verify format | `pnpm fmt` / `pnpm fmt:check`      |
| Deploy (Cloudflare)    | `pnpm run deploy`                  |

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

AGPL-3.0 (see [LICENSE](LICENSE)). Not very important.
