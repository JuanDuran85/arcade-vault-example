-- SPEC 06 — Catálogo y leaderboard reales.
-- `games` contiene solo los juegos que existen de verdad (tienen código en lib/games/).

create table public.games (
  id     text primary key,
  title  text not null,
  short  text not null,
  long   text not null,
  cat    text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover  text not null,
  color  text not null check (color in ('cyan','magenta','yellow','green'))
);

create table public.scores (
  id          uuid primary key default gen_random_uuid(),
  game_id     text not null references public.games (id) on delete cascade,
  player_name text not null check (char_length(trim(player_name)) between 1 and 12),
  score       integer not null check (score >= 0 and score <= 100000000),
  -- Se rellena en el insert y nadie la lee todavía (SPEC 06 out of scope).
  -- Sin `(select ...)`: Postgres no admite subconsultas en un DEFAULT.
  user_id     uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create index scores_game_id_score_idx on public.scores (game_id, score desc);
create index scores_score_idx         on public.scores (score desc);

alter table public.games  enable row level security;
alter table public.scores enable row level security;

create policy games_select_public on public.games
  for select to anon, authenticated using (true);

create policy scores_select_public on public.scores
  for select to anon, authenticated using (true);

-- El default pone auth.uid() (null para anónimos); el check impide firmar como otro.
-- `(select auth.uid())` se evalúa una vez por consulta en vez de por fila.
create policy scores_insert_any on public.scores
  for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

-- security_invoker: sin él la vista correría como su dueño y saltaría RLS.
create view public.game_stats with (security_invoker = on) as
select g.*,
       coalesce(max(s.score), 0)::integer as best,
       count(s.id)::integer               as plays
from public.games g
left join public.scores s on s.game_id = g.id
group by g.id;

insert into public.games (id, title, short, long, cat, cover, color) values
  ('rocas', 'ROCAS', 'Pulveriza asteroides en gravedad cero.',
   'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños, y recoge el disparo triple antes de que se apague.',
   'SHOOTER', 'cover-rocas', 'yellow');
