# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault: a platform for playing games online and competing for the highest score. All UI copy is in Spanish; code, comments, and identifiers are in English.

## Commands

```bash
npm run dev      # start dev server (Next.js 16, Turbopack by default)
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint via eslint-config-next
```

## Testing

No test runner is configured yet.

## Skills

- Always use your frontend design skills to design user interfaces.

## Architecture

- **Next.js 16.3.3 / React 19.2.8, App Router** (`app/`). Per AGENTS.md above, this Next.js version has breaking API changes vs. training data — check `node_modules/next/dist/docs/01-app/` before using any App Router API you're not certain about, especially typed route helpers like `LayoutProps<"/">` (used in `app/layout.tsx`) which don't exist in older Next.js versions.
- **Styling**: Tailwind CSS v4 via `@tailwindcss/postcss` (no `tailwind.config.*` — v4 is CSS-first, configured in `app/globals.css`).
- **Path alias**: `@/*` maps to the repo root (`tsconfig.json`).
- **TypeScript**: `strict` mode on.

### Data & session

Everything is mock/client-side — there is no database or real backend yet:

- `lib/data.ts` — the game catalog (`GAMES`) and `seededScores()`, a seeded PRNG that fabricates deterministic leaderboard rows per game id. Types live in `lib/types.ts`.
- `lib/session.tsx` — `SessionProvider`/`useSession()`, a client-only auth stand-in backed by `localStorage` (`av_user`, `av_scores`). No server session, no password check.
- `app/juego/[id]/jugar/client.tsx` — the "gameplay" screen is a decorative simulation: score ticks up on a `setInterval`, enemies/ship are static CSS elements. There is no real game engine or collision logic behind any title yet, despite `lib/data.ts` listing distinct games.

### Routes

`app/` — `/` (home), `/biblioteca` (game library/filter by `Category`), `/juego/[id]` (detail + leaderboard, `layout.tsx` renders the shared leaderboard sidebar), `/juego/[id]/jugar` (play screen), `/salon-de-la-fama`, `/acerca-de`, `/iniciar-sesion`, `/api/contact` (Resend email send, see below).

### References

`references/` holds the original static HTML/JSX mockups (Spanish copy, inline styles) that pages are built from — when a page's structure or copy seems arbitrary, check the matching file under `references/templates/` or `references/home-about/` first before guessing intent.

## Workflow

Spec-driven development using the `/spec` and `/spec-impl` skills from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills) (`npx skills@latest add Klerith/fernando-skills`). Implemented specs live in `specs/`; check there before assuming a feature is undesigned.

## Environment variables

- `RESEND_API_KEY` — clave de Resend usada por `app/api/contact/route.ts`. Sin prefijo `NEXT_PUBLIC_`: nunca llega al cliente. Ver `.env.example`.
- `SUPABASE_DB_PASSWORD` — present in `.env.example`, reserved for a future direct Postgres connection; nothing currently reads it.
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — used by `lib/supabase/client.ts` and `lib/supabase/server.ts` for Supabase Auth. `NEXT_PUBLIC_` prefix means these reach the client; that's expected, they're the publishable key, not a secret. Ver `.env.example`.
- **Manual one-time step**: in the Supabase dashboard, under Authentication → Providers → Email, disable "Confirm email" — otherwise signup won't leave the user logged in immediately.
