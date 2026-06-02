## Purpose

This file provides short, actionable instructions for AI coding agents working in this repository. Keep it minimal — link to the full docs where appropriate.

## Quick Facts

- **Project type:** React + React Router (server + client), TypeScript, TailwindCSS.
- **Key scripts:** `npm run dev`, `npm run build`, `npm run start`, `npm run typecheck` (see package.json).
- **Primary folders:** `app/` (source), `build/` (output), `public/` (static assets).

## How to run locally (for agents)

- Install: `npm install` (or `pnpm install` if workspace uses pnpm).
- Dev server: `npm run dev` — uses `react-router dev` with HMR.
- Build: `npm run build`.
- Start production-like server: `npm run start` (runs `react-router-serve` on built server bundle).
- Type check before edits: `npm run typecheck`.

## What matters to an AI agent

- Prefer small, focused edits. Run `npm run typecheck` after code changes to catch type errors.
- Link rather than duplicate: refer to [README.md](README.md) for general setup and deployment guidance.
- Keep SSR and client routing in mind: routes live in `app/` and `routes/`, plus `routes.ts` and `react-router.config.ts`.
- Styling: Tailwind is used — avoid adding global CSS unless necessary; prefer component-scoped styles in `app.css`.

## Files to inspect for context

- [README.md](README.md)
- [package.json](package.json)
- [vite.config.ts](vite.config.ts)
- [react-router.config.ts](react-router.config.ts)
- `app/`, `routes/`

## Guidance for PRs

- Run `npm run typecheck` and ensure no TypeScript errors.
- Keep changes minimal per PR; if adding new conventions, document them in AGENTS.md or README.md and link.

## About the project

Go look in readme.md for more about the project.
