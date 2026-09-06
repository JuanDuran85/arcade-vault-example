# SPEC 06 — Catálogo y leaderboard reales en Supabase

> **Status:** Implemented
> **Depends on:** SPEC 04, SPEC 05
> **Date:** 2026-09-05
> **Objective:** Llevar a Supabase las dos cosas que hoy son mentira: el catálogo de juegos (`GAMES` en `lib/data.ts`) y las puntuaciones (`seededScores()`). Una partida real de `rocas` guarda su puntuación en `public.scores` —sin exigir registro— y esa puntuación aparece en el leaderboard del juego, en el ranking global y en el Salón de la Fama.

---

## Por qué existe este spec

SPEC 05 cerró con un criterio marcado `[~]`: la puntuación real de Asteroids se guardaba en `localStorage["av_scores"]` y **nadie la leía nunca**, porque el leaderboard lo fabricaba `seededScores()`, un PRNG determinista. Este spec conecta el juego real con un leaderboard real y, de paso, saca el catálogo del código: es la referencia que `scores.game_id` necesita para no ser texto libre.

Catálogo y leaderboard van en un solo spec porque son la misma migración: `scores.game_id` es una FK a `games.id`, y `best`/`plays` de un juego son agregados de `scores`. Separarlos obligaría a escribir la tabla `scores` dos veces.

**`games` contiene solo los juegos que existen de verdad**, hoy uno: `rocas`. Los otros 7 son decoración estática de SPEC 01 (marcadores movidos por `setInterval`), y al borrar el array local desaparecen de la UI. No se migran.

## Scope

**In:**

- `supabase/migrations/20260905000000_create_games_and_scores.sql` — tablas `public.games` (1 fila: `rocas`) y `public.scores`, la vista `public.game_stats`, índices y RLS. Se aplica al proyecto remoto vía MCP `apply_migration` y queda versionada en el repo.
- `lib/catalog.ts` — `getGames(supabase)` y `getGame(supabase, id)`: leen de `game_stats` y devuelven `Game[]` / `Game | null`.
- `lib/scores.ts` — `topScores(supabase, { gameId?, limit })` (sin `gameId` = ranking global) y `saveScore(supabase, { gameId, name, score })`.
- `lib/data.ts` — se queda **solo** con `CATS`. Desaparecen `GAMES`, `PLAYERS` y `seededScores()`.
- `lib/types.ts` — `Game` cambia `best: number` y `plays: string → number` (ambos derivados). `ScoreRow` gana `gameTitle` para la columna JUEGO del tab GLOBAL.
- `app/page.tsx`, `app/biblioteca/page.tsx`, `app/salon-de-la-fama/page.tsx` — se parten en `page.tsx` (Server Component que consulta) + `client.tsx` (el componente cliente actual, recibiendo los datos por props), siguiendo el patrón que ya usa `app/juego/[id]/jugar/`.
- `app/juego/[id]/layout.tsx` — la barra lateral lee las 10 mejores puntuaciones reales del juego, con estado vacío.
- `app/juego/[id]/page.tsx` — `game` sale de `getGame()`; "RÉCORD MUNDIAL" y "PARTIDAS" salen de `game_stats`; `—` y `0` cuando no hay nada.
- `app/salon-de-la-fama/client.tsx` — tab `GLOBAL` (con columna JUEGO) + un tab por cada fila de `games`. Podio, tabla, estado vacío y resaltado de las filas propias.
- `app/juego/[id]/jugar/client.tsx` — el modal conserva el input de nombre, precargado desde `localStorage["av_player_name"]` o del nombre de sesión; guardar persiste ese nombre para la próxima vez.
- `components/game-card.tsx` — `best` es la puntuación real; `—` si no hay ninguna.
- `lib/session.tsx` — **se le quita `saveScore`** (pasa a `lib/scores.ts`, ya no tiene nada que ver con la sesión) y desaparece todo uso de `av_scores`. Nada más cambia.
- Estilos mínimos en `app/globals.css` para el estado vacío del leaderboard, con las clases y variables existentes (`pixel`, `--ink-faint`).
- `CLAUDE.md`: el catálogo ya no vive en código, existen `games`/`scores`/`game_stats`, `av_scores` desapareció, quedan 1 juego en la UI.

**Out of scope (para specs futuros):**

- **Integración con Supabase Auth**: la columna `scores.user_id` se rellena sola con `auth.uid()` (null para quien no tenga sesión) pero **nadie la lee**. No hay "tu mejor marca" por usuario, ni perfil, ni historial personal; guardar una puntuación no requiere ni consulta la sesión.
- **Panel de administración de juegos**: `games` es de solo lectura desde la app; se edita por migración. No hay alta, baja ni edición desde la UI.
- **Columnas `best`/`plays` mantenidas por trigger**: son agregados calculados en tiempo de consulta por la vista `game_stats`, no campos almacenados que alguien tenga que actualizar.
- **Migrar los 7 juegos placeholder** (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`): desaparecen de la UI al borrar el array local. Cada uno vuelve cuando exista su juego real, con su fila y su código en `lib/games/`.
- **Validar la partida en el servidor**: cualquiera con la publishable key puede insertar una puntuación arbitraria. Ver _Identified risks_.
- **Realtime**: los leaderboards no se actualizan en vivo, solo al cargar la página.
- **Paginación del leaderboard**: top 10 (detalle del juego) y top 12 (Salón), fijos. Tampoco se muestra el rango de un jugador que queda fuera.
- **Migrar a la tabla las partidas que hoy hay en `localStorage["av_scores"]`**: nadie las ha leído nunca.
- **Ticker de "Actividad en vivo" y "top jugadores" de la Home**: siguen hardcodeados (SPEC 02).

## Data model

```sql
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
  user_id     uuid references auth.users (id) on delete set null
                default auth.uid(),
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
create policy scores_insert_any on public.scores
  for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

create view public.game_stats with (security_invoker = on) as
select g.*,
       coalesce(max(s.score), 0)::integer as best,
       count(s.id)::integer               as plays
from public.games g
left join public.scores s on s.game_id = g.id
group by g.id;

insert into public.games values
  ('rocas', 'ROCAS', 'Pulveriza asteroides en gravedad cero.',
   'Tu nave triangular flota en vacío absoluto…', 'SHOOTER', 'cover-rocas', 'yellow');
```

No hay columna `playable`: si una fila está en `games`, el juego existe y se puede jugar y puntuar. La condición `id === "rocas"` que SPEC 05 dejó en `jugar/client.tsx` desaparece con ella.

Tipos en `lib/types.ts`:

```ts
export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: string;
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number; // max(scores.score) del juego, 0 si no hay ninguna
  plays: number; // count(scores) del juego
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // dd/mm/aaaa
  gameTitle: string; // para la columna JUEGO del tab GLOBAL
}
```

`SessionUser` no cambia: este spec no toca la sesión.

Funciones:

```ts
// lib/catalog.ts
export async function getGames(supabase: SupabaseClient): Promise<Game[]>;
export async function getGame(
  supabase: SupabaseClient,
  id: string,
): Promise<Game | null>;

// lib/scores.ts
export async function topScores(
  supabase: SupabaseClient,
  opts: { gameId?: string; limit?: number },
): Promise<ScoreRow[]>;

export async function saveScore(
  supabase: SupabaseClient,
  entry: { gameId: string; name: string; score: number },
): Promise<{ error: string | null }>;
```

`topScores` consulta `select score, player_name, created_at, games(title) from scores [where game_id = $1] order by score desc limit $2`, calcula `rank` por posición y formatea `created_at` con `toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })` (sin `2-digit` saldría `6/9/2026`, no `06/09/2026`). Si falla devuelve `[]` y registra el error: un leaderboard caído no debe romper la página del juego.

`saveScore` inserta `{ game_id, player_name: name.trim().toUpperCase().slice(0, 12), score }` —nunca `user_id`, que lo pone el default— y en caso de éxito guarda el nombre en `localStorage["av_player_name"]`.

## Implementation plan

1. Crear y aplicar `supabase/migrations/20260905000000_create_games_and_scores.sql` (MCP `apply_migration`). Verificar con `list_tables` que existen ambas tablas con RLS activo y la fila `rocas`, y con `get_advisors` que no quedan avisos de seguridad (en particular, que la vista no dispara el aviso de `security_definer`).
2. Editar `lib/types.ts` con los tipos de arriba. Esto rompe la compilación a propósito — los pasos siguientes la reparan.
3. Editar `lib/data.ts`: borrar `GAMES`, `PLAYERS` y `seededScores()`; queda solo `CATS`.
4. Crear `lib/catalog.ts` y `lib/scores.ts`. Tipar el cliente como `SupabaseClient` para que sirvan a los dos clientes de SPEC 04.
5. Editar `lib/session.tsx`: eliminar `saveScore` del contexto y de la interfaz. Nada más.
6. Partir las tres pantallas cliente que necesitan el catálogo en `page.tsx` (servidor, consulta) + `client.tsx` (el componente actual con props): `app/page.tsx`, `app/biblioteca/page.tsx`, `app/salon-de-la-fama/page.tsx`.
7. Editar `app/juego/[id]/layout.tsx`, `app/juego/[id]/page.tsx` y `app/juego/[id]/jugar/page.tsx`: `GAMES.find(...)` → `await getGame(await createClient(), id)`, con `notFound()` si es `null`. El layout sustituye `seededScores(...)` por `topScores(supabase, { gameId: id, limit: 10 })` y renderiza el estado vacío cuando no hay filas.
8. `app/juego/[id]/page.tsx`: RÉCORD MUNDIAL = `game.best || "—"`, PARTIDAS = `game.plays`.
9. `app/salon-de-la-fama/client.tsx`: tabs = `GLOBAL` + una por juego; `useEffect` que llama `topScores(createClient(), { gameId: tab === "global" ? undefined : tab, limit: 12 })`; columna JUEGO visible solo en `GLOBAL`; podio que tolera menos de 3 filas; estado vacío. Se borran `youRank`, `youScore`, la fecha fija y el bloque "TU MEJOR MARCA".
10. `app/juego/[id]/jugar/client.tsx`: el input de nombre se precarga con `localStorage["av_player_name"] ?? user?.name ?? ""`; el botón `GUARDAR PUNTUACIÓN` llama a `saveScore`, se deshabilita mientras corre y con el input vacío, muestra `▸ PUNTUACIÓN GUARDADA_` en éxito y el error en rojo si falla. Desaparece la condición `id === "rocas"`.
11. `components/game-card.tsx`: `best` real o `—`.
12. Añadir a `app/globals.css` la clase del estado vacío ("SÉ EL PRIMERO EN ENTRAR AL SALÓN DE LA FAMA").
13. Actualizar `CLAUDE.md` (sección **Data & session**).
14. Pasada manual: jugar `/juego/rocas/jugar` hasta perder, guardar y comprobar la fila en `/juego/rocas`, en el tab ROCAS y en el tab GLOBAL; recargar y comprobar que el nombre viene precargado; comprobar que `/juego/caida` devuelve 404 y que `/biblioteca` lista un solo juego. `npm run lint` y `npm run build` sin errores.

## Acceptance criteria

- [x] `npm run build` y `npm run lint` terminan sin errores.
- [x] La migración está en el repo y `public.games` (1 fila), `public.scores` y la vista `public.game_stats` existen en el proyecto remoto con RLS activo.
- [x] `get_advisors` no reporta avisos de seguridad sobre las tablas nuevas ni sobre la vista.
- [x] **Sin sesión**, terminar una partida de `rocas`, escribir un nombre y pulsar `GUARDAR PUNTUACIÓN` crea una fila con `user_id = null`, y el modal muestra `▸ PUNTUACIÓN GUARDADA_`.
- [x] Al volver a jugar, el input del modal viene precargado con el último nombre usado: basta pulsar guardar.
- [x] Esa puntuación aparece (al recargar) en la barra lateral de `/juego/rocas`, en el tab ROCAS y en el tab GLOBAL del Salón de la Fama.
- [x] El tab GLOBAL ordena por puntuación sin filtrar por juego y muestra la columna JUEGO.
- [x] Un juego sin puntuaciones muestra "SÉ EL PRIMERO EN ENTRAR AL SALÓN DE LA FAMA" en `/juego/[id]` y en el Salón, sin filas inventadas y sin errores en consola.
- [x] `/juego/rocas` muestra como récord la puntuación real más alta, o `—`, y como PARTIDAS el número real de puntuaciones guardadas.
- [x] `/biblioteca` y la Home listan los juegos leídos de Supabase (hoy: ROCAS), con búsqueda y filtro por categoría funcionando igual que antes.
- [x] `/juego/caida` y el resto de ids placeholder devuelven 404.
- [x] `GAMES`, `seededScores`, `PLAYERS` y toda referencia a `av_scores` han desaparecido del código (`grep` limpio salvo en `references/` y specs anteriores).
- [x] Nadie puede insertar una fila con el `user_id` de otro usuario, ni escribir en `public.games`, con la publishable key.

## Decisions taken and discarded

- **Solo `rocas` entra en `games`**: la tabla es "los juegos que tenemos", y tener un juego significa tener su código en `lib/games/`. Sembrar los otros 7 los convertiría en filas reales que apuntan a nada jugable, y obligaría a una columna `playable` para volver a distinguirlos — reintroduciendo en la BD la distinción que la propia tabla ya resuelve.
- **Sin columna `playable`**: con solo juegos reales en la tabla, sería `true` en todas las filas. Su ausencia elimina de paso el `id === "rocas"` hardcodeado de SPEC 05.
- **Tabla `games` con todas las columnas y `lib/data.ts` vaciado en el mismo spec**: un híbrido (catálogo en la tabla, portadas y textos en código) deja dos fuentes de verdad para el mismo juego. **Tampoco hay fallback a datos locales si la consulta falla**: sería un modo de fallo silencioso que muestra un catálogo obsoleto en vez de un error.
- **`user_id` se escribe pero no se lee**: la columna cuesta una cláusula `default` y es la única oportunidad de capturar la asociación en el momento del insert —no se puede rellenar después—. Leerla (perfil, "tu mejor marca", historial) es un spec de auth propio. Mientras tanto, guardar una puntuación no consulta la sesión, y por eso `saveScore` sale de `lib/session.tsx`.
- **RLS se configura aquí, no en un spec futuro de seguridad**: son 9 líneas en la misma migración. Sin RLS, la publishable key —que va en el bundle del navegador— permite a cualquiera borrar la tabla de puntuaciones entera. Una tabla escribible desde internet no es deuda técnica aplazable, y activarla después exige revisar todas las consultas ya escritas.
- **`best` y `plays` en una vista, no en columnas**: guardarlos como columnas exige un trigger que los actualice en cada insert. La vista los calcula en la consulta que ya se hace, contra los índices que ya existen.
- **`plays` pasa de "15.6K" a `count(scores)`**: el número queda pequeño (0–3) pero es verdad. Contar partidas _iniciadas_ es otro spec; inventarlas otra vez sería volver a `seededScores()` con más pasos.
- **Puntuaciones anónimas permitidas**: es el requisito del producto —jugar no exige registrarse—. El precio es que el leaderboard es falsificable; ver riesgos.
- **`(select auth.uid())` en vez de `auth.uid()` en la política**: envuelto en subconsulta se evalúa una vez en lugar de por fila (recomendación de rendimiento de RLS de Supabase).
- **`player_name` denormalizado en la fila**: las partidas anónimas no tienen usuario del que leer un nombre, y `auth.users` no es consultable desde el cliente.
- **El nombre se recuerda en `localStorage`, no en la BD**: es una comodidad del navegador para un jugador que puede no tener cuenta.
- **`seededScores()` se borra en vez de seedearse en la tabla**: meter puntuaciones inventadas como filas reales las mezcla con las de verdad para siempre. Un leaderboard vacío es honesto y es menos código.
- **Una fila por partida, sin `unique (player_name, game_id)`**: el insert queda trivial y se conserva el historial. El coste: un buen jugador puede ocupar varios puestos del top; si molesta, la corrección es un `distinct on` en la consulta, no un cambio de esquema.
- **Tab `GLOBAL` en el Salón en vez de una ruta nueva**: es la misma tabla con la misma consulta sin `where`. Una ruta propia duplicaría podio, tabla y estados vacío/carga.
- **Insert directo desde el cliente, sin Server Action ni ruta de API**: RLS ya es la frontera y SPEC 04 dejó el cliente de browser montado. Una capa intermedia solo reenviaría el mismo insert — y no añadiría seguridad, porque no puede verificar la partida.
- **Dos consultas en `/juego/[id]`** (el `layout` para la lista, la `page` para el juego): Next.js no permite pasar props de un layout a su page.

## Identified risks

- **La UI se queda con un solo juego**: la Home, `/biblioteca` y el Salón pasan de 8 tarjetas a 1, y los ids placeholder devuelven 404. Es el resultado buscado —solo `rocas` existe de verdad— pero es el cambio más visible del spec y conviene no confundirlo con un fallo de la consulta.
- **El leaderboard es falsificable**: con la publishable key y `curl`, cualquiera inserta `{game_id: "rocas", player_name: "X", score: 99999999}`. Es consecuencia directa de permitir jugar sin registro, y ninguna validación de cliente lo evita. Mitigado solo en lo grosero: `check` de rango en `score` y de longitud en `player_name`. La corrección real (firmar la partida en el servidor, o un Edge Function que valide duración/eventos) es un spec propio.
- **Estado vacío al desplegar**: `rocas` queda sin puntuaciones hasta que alguien juegue. Los criterios de aceptación distinguen "vacío" de "error en consola".
- **El catálogo pasa a depender de la red**: si Supabase no responde, `/` y `/biblioteca` quedan sin juegos donde antes eran datos en el bundle. Es el precio aceptado de tener una sola fuente de verdad.
- **La vista `game_stats` sin `security_invoker = on`** correría como su dueño y saltaría RLS: el advisor de Supabase lo marca. Verificarlo es un criterio de aceptación explícito.
- **`created_at` se formatea en servidor y en cliente**: ambas rutas usan `toLocaleDateString("es-ES")` con locale fija; usar la del navegador provocaría desajuste de hidratación.
