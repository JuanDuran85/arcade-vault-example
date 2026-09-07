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

The catalog and the leaderboard are real Supabase data (SPEC 06). Types live in `lib/types.ts`.

- **Tables** (`supabase/migrations/`) — `public.games` is the catalog and `public.scores` one row per finished game, with `scores.game_id` a FK to `games.id`. The view `public.game_stats` is `games` plus `best`/`plays` aggregated at query time; nothing stores those. RLS: everyone reads both tables, anyone (signed in or not) inserts a score, and **nobody writes `games` from the app** — it is edited by migration only. `scores.user_id` is filled by the column default `auth.uid()` (null for anonymous players) and **is not read anywhere yet**.
- **`games` holds only games that really exist** — today two rows, `rocas` and `caida`. The 7 placeholders of SPEC 01 are gone from the code, so their ids 404. A game exists ⇔ it has a row here ⇔ it has a module in `lib/games/` **and an entry in `lib/games/registry.ts`**; there is no `playable` column and no `id === "rocas"` check any more.
- `lib/catalog.ts` — `getGames()` / `getGame()` read `game_stats`. Errors **throw** on purpose: there is no fallback to local data, because a stale catalog is worse than a visible error. `getGame` returning `null` means "no such game" and only that, so callers can `notFound()` on it safely.
- `lib/scores.ts` — `topScores()` (no `gameId` = global ranking) and `saveScore()`. `topScores` never throws: it logs and returns `[]`, so a broken leaderboard cannot take down the game page. `saveScore` never sends `user_id` (the column default does it) and remembers the player name in `localStorage["av_player_name"]`.
- `lib/data.ts` — only `CATS` survives; `GAMES`, `PLAYERS` and `seededScores()` are gone.
- `lib/session.tsx` — `SessionProvider`/`useSession()` over real Supabase Auth (SPEC 04). It no longer knows anything about scores: **saving a score does not consult the session**, and `av_scores` no longer exists.
- Screens that need the catalog are split `page.tsx` (Server Component, queries) + `client.tsx` (interactive part, gets data via props): `/`, `/biblioteca`, `/salon-de-la-fama`. `/juego/[id]` queries in both `layout.tsx` (the leaderboard sidebar) and `page.tsx` (the game) because Next.js cannot pass props from a layout to its page.
- `lib/games/registry.ts` — **where a new game is registered** (SPEC 07). Holds the shared `GameState` / `GameCallbacks` / `GameHandle` types and the `GAMES` map `id → { start, controls }`. Adding a game = a row in `games`, a module in `lib/games/`, and an entry here. `GameState` has `score` and `lives` mandatory (every game has lives; `caida` always reports `1`) plus named optionals `level` / `lines`, so the HUD can label each number and the compiler checks it. **Game over is an event, not a state field**: the game emits `onGameOver(finalScore)` exactly once per run — `GameState` has no `gameOver`.
- `lib/games/asteroids.ts` (`rocas`) and `lib/games/caida.ts` (`caida`, Tetris) — both ported almost verbatim from `references/started-games/`, all state inside the `start()` closure so two mounts never share a board. Each draws its own in-canvas HUD on purpose, coexisting with the platform's React HUD. Neither touches the DOM or `localStorage`.
- `app/juego/[id]/jugar/client.tsx` — the play screen. Reads `GAMES[id]`; keeps the whole `GameState` in one `useState` and renders NIVEL/LÍNEAS only when that field is defined. **Pause is the platform's alone**: a `paused` prop reaches the game through `handle.setPaused()`, and no game ports its own pause key. Game over opens the modal from `onGameOver` and writes to `public.scores`.

### Routes

`app/` — `/` (home), `/biblioteca` (game library/filter by `Category`), `/juego/[id]` (detail + leaderboard, `layout.tsx` renders the shared leaderboard sidebar), `/juego/[id]/jugar` (play screen), `/salon-de-la-fama`, `/acerca-de`, `/iniciar-sesion`, `/api/contact` (Resend email send, see below).

### References

`references/` holds the original static HTML/JSX mockups (Spanish copy, inline styles) that pages are built from — when a page's structure or copy seems arbitrary, check the matching file under `references/templates/` or `references/home-about/` first before guessing intent.

## Workflow

Spec-driven development using the `/spec` and `/spec-impl` skills from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills) (`npx skills@latest add Klerith/fernando-skills`). Implemented specs live in `specs/`; check there before assuming a feature is undesigned.

## Environment variables

- `RESEND_API_KEY` — clave de Resend usada por `app/api/contact/route.ts`. Sin prefijo `NEXT_PUBLIC_`: nunca llega al cliente. Ver `.env.example`.
- `SUPABASE_DB_PASSWORD` — present in `.env.example`, reserved for a future direct Postgres connection; nothing currently reads it.
- **Migrations** live in `supabase/migrations/` and are applied to the remote project with the Supabase MCP `apply_migration`. There is no Supabase CLI set up in this repo, so the remote history's timestamps do not match the local filenames.
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — used by `lib/supabase/client.ts` and `lib/supabase/server.ts` for Supabase Auth. `NEXT_PUBLIC_` prefix means these reach the client; that's expected, they're the publishable key, not a secret. Ver `.env.example`.
- **Manual one-time step**: in the Supabase dashboard, under Authentication → Providers → Email, disable "Confirm email" — otherwise signup won't leave the user logged in immediately.
