# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault: a platform for playing games online and competing for the highest score. Currently unmodified `create-next-app` scaffold — no game features implemented yet.

## Commands

```bash
npm run dev      # start dev server (Next.js 16, Turbopack by default)
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint via eslint-config-next
```

No test runner is configured yet.

## Architecture

- **Next.js 16.3.3 / React 19.2.8, App Router** (`app/`). Per AGENTS.md above, this Next.js version has breaking API changes vs. training data — check `node_modules/next/dist/docs/01-app/` before using any App Router API you're not certain about, especially typed route helpers like `LayoutProps<"/">` (used in `app/layout.tsx`) which don't exist in older Next.js versions.
- **Styling**: Tailwind CSS v4 via `@tailwindcss/postcss` (no `tailwind.config.*` — v4 is CSS-first, configured in `app/globals.css`).
- **Path alias**: `@/*` maps to the repo root (`tsconfig.json`).
- **TypeScript**: `strict` mode on.

## Workflow

Spec-driven development using the `/spec` and `/spec-impl` skills from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills) (`npx skills@latest add Klerith/fernando-skills`).
