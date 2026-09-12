# SPEC 01 (game-jam/rana) — Quinto juego real: `rana` (Frogger)

> **Status:** Draft
> **Depends on:** SPEC 06, SPEC 07
> **Date:** 2026-09-11
> **Objective:** Diseñar y construir `rana` desde cero en `lib/games/rana.ts` — una rana que cruza carriles de carretera y de río sin ningún motor de físicas, solo movimiento en grilla y cinemática simple —, registrarla en el catálogo y en `registry.ts` para que `/juego/rana/jugar` sea una partida real que guarda puntuación.

---

## Por qué existe este spec

Es el quinto juego real y, como `snake` en SPEC 10, el primero de esta tanda **sin** referencia en `references/started-games/`: no hay ningún `game.js` de Frogger que portar, la mecánica se diseña aquí mismo. El tema lo pidió el propio usuario ("Frogger, cruzar la carretera y el río sin morir aplastado, con carriles de obstáculos en movimiento") con una restricción explícita: **sin física**. Eso no es una limitación que sortear, es la forma natural del género — Frogger clásico siempre fue movimiento por grilla, nunca un motor de físicas. Este spec la respeta al pie de la letra: la rana salta exactamente una celda por pulsación (grid puro, sin aceleración ni gravedad) y los obstáculos de cada carril se mueven a velocidad constante (`x += velocidad · dt`), la misma cinemática simple que ya usa la bola de `bloques` — sin resolución de colisiones física, sin fuerzas, solo traslación y comprobaciones de solapamiento de rectángulos.

El nombre "Frogger" es una marca registrada de Konami. Siguiendo la misma convención que ya usó la plataforma (Asteroids → `rocas`, Tetris → `caida`, Arkanoid → `bloques`), el juego se llama **RANA**: mismo género, sin el nombre comercial.

La categoría `ARCADE` ya tiene dos juegos (`bloques`, `snake`); no hay una categoría de "cruce" en el `check` de `cat`, así que `rana` entra en `ARCADE` igual que ellos — el `check` de `supabase/migrations/20260905000000_create_games_and_scores.sql` no deja otra opción real. El color `green` también lo usa `snake`; el `check` de `color` no exige unicidad, y verde es, literalmente, el color de una rana.

`.cover-rana` existe en `app/globals.css` desde SPEC 01 (la pantalla original) y no se ha usado nunca: un fondo oscuro con franjas horizontales cian (los carriles) y un punto verde al centro (la rana). Es, sin que nadie lo planeara así, la portada exacta de este juego. Cero CSS nuevo.

### Lo que funciona solo, sin escribir código

Consecuencia de insertar la fila en `games` y de llamar a `saveScore`. Se lista para que nadie lo implemente por segunda vez:

- El modal de fin de partida (nombre + `GUARDAR PUNTUACIÓN`) ya es genérico por `id` en `app/juego/[id]/jugar/client.tsx`.
- La barra lateral de `/juego/rana` llama a `topScores(supabase, { gameId: "rana", limit: 10 })` desde SPEC 06.
- El Salón de la Fama construye sus tabs desde las filas de `games`: `RANA` aparece sola, sin tocar `salon-de-la-fama/client.tsx`, y sus puntuaciones entran también en el tab `GLOBAL`.
- El HUD React etiqueta PUNTUACIÓN, VIDAS y NIVEL desde SPEC 07, y omite LÍNEAS porque `rana` no reporta ese campo.
- El botón PAUSA y el flujo de `handle.setPaused()` ya existen en `client.tsx`; este juego solo tiene que respetarlos, no reinventarlos.

## Scope

**In:**

- Migración `supabase/migrations/20260911010000_add_game_rana.sql` con el `insert into public.games` de la fila `rana`. No toca el esquema ni las migraciones anteriores.
- `lib/games/rana.ts` — `startRana(canvas, callbacks): GameHandle`, mismo contrato que los otros cuatro juegos, todo el estado dentro del closure de `start()`.
- Canvas `800×600`, grilla de celdas de `40px` (`20×15` celdas). El tablero, de abajo hacia arriba: 3 filas de salida seguras, 5 carriles de carretera con coches, 1 fila mediana segura, 5 carriles de río con troncos, 1 fila de meta con 5 nenúfares.
- Movimiento de la rana en saltos discretos de una celda por pulsación de `↑ ↓ ← →` **y** `WASD`, con `preventDefault`, reencaje a grilla en cada salto y un cooldown de 120 ms que ignora el auto-repeat del teclado del sistema operativo.
- Carriles de carretera y de río con obstáculos que se mueven a velocidad constante (`x += dir · speed · speedMultiplier · dt`) y envuelven al salir del canvas por el lado contrario.
- Colisión de carretera: pisar un coche pierde una vida. Colisión de río: quedar en una fila de río sin un tronco debajo pierde una vida; subirse a un tronco arrastra a la rana con su movimiento, y si el tronco la saca del canvas también pierde una vida.
- Meta: 5 nenúfares fijos. Llegar a uno libre lo ocupa, suma 50 puntos y hace reaparecer a la rana en la salida. Llegar fuera de un nenúfar o sobre uno ya ocupado pierde una vida. Llenar los 5 nenúfares suma 100 puntos, sube el nivel, vacía los nenúfares y acelera todos los carriles (multiplicador con techo `2.5×`).
- Puntuación por avance: cada salto hacia una fila nunca antes alcanzada en la vida actual suma 10 puntos; retroceder o repetir fila no puntúa.
- Fin de partida: 0 vidas → `onGameOver(score)`, una sola vez (guarda `finished`).
- `GameState`: `lives` empieza en 3 y baja con cada muerte; `level` sí se reporta; `lines` se queda sin definir. **No se agrega ni se toca ningún campo de `registry.ts`.**
- HUD dentro del canvas (puntuación, vidas, nivel) duplicado a propósito con el HUD React.
- Entrada nueva en `lib/games/registry.ts` y su import: controles `"↑ ↓ ← → SALTAR · WASD TAMBIÉN"`.
- Nota en la sección **Data & session** de `CLAUDE.md`.

**Out of scope (para specs futuros):**

- Sonido: cero eventos de audio en este spec. Va en `02-sonidos-rana.md`.
- Variedad de obstáculos de río (tortugas que se hunden) y quitar el techo de `2.5×` al multiplicador de velocidad. Va en `03-dificultad-carriles.md`.
- Temporizador por vida (la barra de tiempo del Frogger original): agregaría un campo de estado nuevo sin que se haya pedido; la presión ya viene de los carriles.
- Cocodrilos, power-ups, mapas alternativos, controles táctiles, modo dos jugadores.
- Cambios a `lib/catalog.ts`, `lib/scores.ts`, el esquema de Supabase, `app/juego/[id]/layout.tsx` o `app/salon-de-la-fama/client.tsx` — genéricos por `game_id` desde SPEC 06.
- Una clase `.cover-*` nueva: se reusa `.cover-rana`, ya en `globals.css` sin usar desde SPEC 01.

## Data model

Fila exacta del catálogo:

```sql
insert into public.games (id, title, short, long, cat, cover, color) values
  ('rana', 'RANA', 'Cruza la carretera y el río sin que te aplasten.',
   'Guía a la rana carril por carril: esquiva los coches de la carretera, salta de tronco en tronco sin caer al agua y llega a un nenúfar libre en la otra orilla. Llenar los cinco nenúfares sube de nivel y acelera todos los carriles. Tres vidas, ni una más.',
   'ARCADE', 'cover-rana', 'green');
```

`GameState` de `registry.ts` no cambia: `rana` reporta `score`, `lives` y `level`; `lines` se queda sin definir.

Estado interno del juego, dentro del closure:

```ts
const CELL = 40;
const COLS = 20; // 800 / 40
const ROWS = 15; // 600 / 40

// Filas, de arriba (0) hacia abajo (14):
const GOAL_ROW = 0; // 5 nenúfares
const RIVER_ROWS = [1, 2, 3, 4, 5]; // troncos
const MEDIAN_ROW = 6; // segura
const ROAD_ROWS = [7, 8, 9, 10, 11]; // coches
// filas 12-14: zona de salida, segura

const SLOT_COLS = [1, 5, 9, 13, 17]; // columnas de los 5 nenúfares
const STARTING_ROW = 14;
const STARTING_COL = 9; // alineado con el nenúfar central

const MOVE_COOLDOWN_MS = 120;

interface Lane {
  row: number;
  dir: 1 | -1; // 1 = derecha, -1 = izquierda
  speed: number; // px/s, antes del multiplicador de nivel
  gap: number; // separación entre obstáculos consecutivos
  w: number; // ancho de cada obstáculo
  obstacles: { x: number }[];
}

let roadLanes: Lane[]; // una por ROAD_ROWS
let riverLanes: Lane[]; // una por RIVER_ROWS, aquí todas son troncos

let frog = { x: STARTING_COL * CELL, row: STARTING_ROW };
let bestRowThisLife = STARTING_ROW; // para la puntuación por avance
let lastMoveAt = -Infinity;

let slots: boolean[] = [false, false, false, false, false];
let score = 0;
let lives = 3;
let level = 1;
let speedMultiplier = 1; // sube con el nivel, techo 2.5 (ver Decisions)

let lastTime = 0;
let finished = false;
```

Valores de referencia para los carriles (el implementador puede ajustar el detalle fino en la pasada manual, pero deben mantener la variedad dir/velocidad):

| Fila (carretera) | dir | speed (px/s) | ancho obstáculo | gap |
| ---------------- | --- | ------------ | --------------- | --- |
| 7                | -1  | 90           | 60              | 160 |
| 8                | 1   | 130          | 60              | 200 |
| 9                | -1  | 110          | 80              | 220 |
| 10               | 1   | 150          | 60              | 180 |
| 11               | -1  | 100          | 70              | 200 |

| Fila (río) | dir | speed (px/s) | ancho tronco | gap |
| ---------- | --- | ------------ | ------------ | --- |
| 1          | 1   | 70           | 120          | 100 |
| 2          | -1  | 90           | 100          | 140 |
| 3          | 1   | 80           | 140          | 120 |
| 4          | -1  | 60           | 100          | 160 |
| 5          | 1   | 100          | 120          | 100 |

## Implementation plan

1. Escribir y aplicar la migración `supabase/migrations/20260911010000_add_game_rana.sql` con el `insert` de arriba, con `apply_migration`. Verificar con `list_tables` (una fila más en `games`) y `get_advisors` sin avisos nuevos. Comprobación manual: `/biblioteca` lista la tarjeta RANA, el filtro ARCADE la incluye, `/juego/rana` deja de dar 404 (el botón JUGAR todavía no funciona).
2. Crear `lib/games/rana.ts` con la estructura del módulo (closure, constantes de grilla, `start`/`stop`/`setPaused`/`endGame`, guarda `finished`), dibujando de momento solo el tablero (franjas de salida/carretera/mediana/río/meta) y la rana en su posición inicial sobre el canvas `800×600`. `npm run build` pasa.
3. Generar `roadLanes` y `riverLanes` con la tabla de valores de arriba, avanzar cada obstáculo cada frame (`obstacle.x += lane.dir * lane.speed * speedMultiplier * dt`) y envolverlo al salir del canvas (`x = -w` o `x = canvas.width` según el sentido). Dibujar coches y troncos como rectángulos de color.
4. Controles: `keydown` en `window` mueve la rana con `preventDefault` en las 4 flechas y sus equivalentes `WASD`. Antes de mover: si `Date.now() - lastMoveAt < MOVE_COOLDOWN_MS`, ignorar; si no, reencajar `frog.x` al múltiplo de `CELL` más cercano, aplicar el delta de fila o columna con los límites del tablero, y actualizar `lastMoveAt`. `stop()` quita el listener.
5. Colisión de carretera (cada frame, si `frog.row` está en `ROAD_ROWS`): si el rectángulo de la rana solapa el de algún coche de esa fila, perder una vida. Colisión de río (cada frame, si `frog.row` está en `RIVER_ROWS`): buscar un tronco de esa fila que solape a la rana; si lo hay, arrastrar (`frog.x += lane.dir * lane.speed * speedMultiplier * dt`) y perder una vida si `frog.x` sale del canvas; si no lo hay, perder una vida de inmediato.
6. Lógica de meta (solo en el instante en que un salto hace `frog.row === GOAL_ROW`): calcular la columna con `Math.round(frog.x / CELL)`; si coincide con un `SLOT_COLS` libre, marcarlo ocupado, sumar 50 puntos y reaparecer en la salida; si no, perder una vida. En cualquier salto hacia una fila menor que `bestRowThisLife`, sumar 10 puntos y actualizar `bestRowThisLife`. Al perder una vida, si `lives === 0` → `finished = true`, `onGameOver(score)`; si no, reaparecer en `(STARTING_ROW, STARTING_COL)` y reiniciar `bestRowThisLife`.
7. Al llenar los 5 `slots`: sumar 100 puntos, vaciar `slots`, subir `level`, recalcular `speedMultiplier = Math.min(2.5, 1 + (level - 1) * 0.15)`.
8. Cablear `onState` (se notifica cuando cambian `score`, `lives` o `level`) y `setPaused`/`endGame` igual que los otros cuatro juegos: `setPaused(true)` congela obstáculos y rana (no se llama a `update`) pero `draw()` se sigue llamando cada frame; al reanudar se reinicia `lastTime`.
9. Añadir la entrada a `lib/games/registry.ts`: `rana: { start: startRana, controls: "↑ ↓ ← → SALTAR · WASD TAMBIÉN" }`.
10. Actualizar la sección **Data & session** de `CLAUDE.md`: quinto juego real, primero con un tablero de carriles horizontales de obstáculos con movimiento continuo (cinemática simple, sin motor de físicas) combinado con movimiento de jugador en grilla pura.
11. Pasada manual (ver criterios de aceptación).

## Acceptance criteria

- [ ] `/juego/rana` existe, muestra el cover verde de `.cover-rana` y su sidebar de leaderboard (top 10).
- [ ] En `/juego/rana/jugar` la rana salta una celda por pulsación de flecha o `WASD`, y nunca sale del canvas.
- [ ] Sostener una tecla no dispara más de un salto cada ~120 ms, pese al auto-repeat del teclado.
- [ ] Pisar un coche en cualquiera de los 5 carriles de carretera pierde una vida y la rana reaparece en la fila de salida.
- [ ] Quedarse quieta en el río sin un tronco debajo pierde una vida, aunque la rana no se haya movido (el tronco se fue).
- [ ] Subirse a un tronco arrastra a la rana con su movimiento; si el tronco la saca del canvas, pierde una vida.
- [ ] Llegar a un nenúfar libre suma 50 puntos, lo marca ocupado y hace reaparecer a la rana en la salida.
- [ ] Llegar a la fila de meta fuera de un nenúfar, o sobre uno ya ocupado, pierde una vida.
- [ ] Cada salto hacia una fila nunca antes alcanzada en la vida actual suma exactamente 10 puntos; retroceder no resta puntos ni permite repetirlos.
- [ ] Llenar los 5 nenúfares suma 100 puntos, sube el nivel, vacía los nenúfares y acelera visiblemente todos los carriles; el multiplicador nunca supera `2.5×`.
- [ ] A 0 vidas, `onGameOver(score)` se emite una sola vez y abre el modal de fin de partida.
- [ ] `PAUSA` congela coches, troncos y la rana (no se llama a `update`), pero el tablero se sigue dibujando (no se queda en negro); `REANUDAR` no produce un salto de posición en los obstáculos.
- [ ] El botón `FIN` termina la partida con la puntuación acumulada hasta ese momento, una sola vez.
- [ ] Pulsar las flechas o `WASD` durante la partida no hace scroll de la página.
- [ ] El HUD React muestra PUNTUACIÓN, VIDAS y NIVEL.
- [ ] La fila de controles bajo el CRT es `"↑ ↓ ← → SALTAR · WASD TAMBIÉN"`.
- [ ] Terminar la partida guarda una puntuación real con `saveScore`, visible en el sidebar de `/juego/rana`, en su propio tab del Salón de la Fama (aparece solo, sin tocar `salon-de-la-fama/client.tsx`) y en el tab GLOBAL.
- [ ] Salir de la pantalla detiene el loop y quita el listener de teclado: volver a entrar no duplica carriles ni acelera la rana.
- [ ] `JUGAR DE NUEVO` empieza una partida nueva con 0 puntos, nivel 1, 3 vidas y los 5 nenúfares vacíos.
- [ ] `grep` limpio de `new Audio`, `AudioContext`, `localStorage` y `document.` en `lib/games/rana.ts` (este spec no tiene sonido).
- [ ] Un id que no está en `games` sigue devolviendo 404.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisions taken and discarded

- **Sí: diseñar desde cero, no portar.** No hay `game.js` de Frogger en `references/started-games/`; mismo caso que `snake` en SPEC 10.
- **Sí: id `rana`, no `frogger`.** "Frogger" es marca registrada de Konami; se sigue la convención ya usada por `rocas`, `caida` y `bloques` de nombrar el juego por su mecánica/tema, no por el título comercial.
- **Sí: reusar `.cover-rana`.** Sin usar desde SPEC 01, y su gradiente de franjas cian con un punto verde central es, sin ajustes, la portada de este juego. CSS nuevo: cero.
- **Sí: color `green`, aunque ya lo use `snake`.** El `check` de `color` no exige unicidad por juego; verde es el color natural de una rana.
- **Sí: canvas `800×600`, el tamaño por defecto de la plataforma.** El tablero de carriles horizontales encaja de forma natural en el formato apaisado que ya usan `rocas`, `caida` y `bloques`; no hay motivo, a diferencia de `snake`, para un canvas cuadrado.
- **Sí: movimiento de la rana en saltos discretos de una celda (grid puro).** Es la restricción explícita del usuario ("movimiento por carriles/grid, sin motor físico") y también cómo funciona el Frogger original.
- **Sí: obstáculos de carril con cinemática simple (`x += velocidad · dt`), no un motor de físicas.** Coincide con la restricción del usuario y con el patrón que ya usa la bola de `bloques`: traslación a velocidad constante y comprobación de solapamiento de rectángulos, sin gravedad, fuerzas ni resolución de colisiones física.
- **Sí: cooldown de 120 ms entre saltos.** Es debounce de entrada, no una mecánica de física: sin él, el auto-repeat del sistema operativo dispararía varios saltos por una sola pulsación sostenida.
- **Sí: la posición horizontal de la rana se guarda en píxeles (`frog.x`, float), no como columna entera.** Es lo único que permite que un tronco la arrastre de forma continua; cada salto (`↑ ↓ ← →`) reencaja `frog.x` a la grilla antes de moverse, así que fuera del arrastre por tronco la rana nunca se ve "flotando" fuera de celda.
- **Sí: 5 nenúfares fijos en columnas `[1, 5, 9, 13, 17]`, simétricos con la columna de salida (9).** Saltar en línea recta desde la salida lleva directo al nenúfar central.
- **No: temporizador por vida.** El Frogger original tiene una barra de tiempo; añadirla mete un campo de estado nuevo sin que el usuario lo haya pedido, y la presión ya la dan los carriles.
- **No: tortugas que se hunden en este spec.** Es la capacidad que agrega `03-dificultad-carriles.md`; aquí los 5 carriles de río son troncos homogéneos.
- **No: sonido.** Es la capacidad que agrega `02-sonidos-rana.md`.
- **No: cambios a `GameState`/`GameCallbacks`/`GameHandle` en `registry.ts`.** `rana` cabe entera en los campos que ya existen (`score`, `lives`, `level`).

## Identified risks

| Riesgo                                                                                                                               | Mitigación                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un `dt` grande (caída de frames) podría dejar que un coche "salte" sobre la rana sin que el solapamiento se detecte nunca.           | Anchos de coche generosos (60-80 px) frente al desplazamiento esperado a 30 fps; mismo razonamiento que ya acepta la bola de `bloques`.                                                            |
| El cooldown de salto mal calibrado se siente "pegajoso" o, al revés, no filtra el auto-repeat.                                       | Criterio de aceptación explícito sobre los 120 ms; es casi imperceptible para un salto intencional y sí bloquea el auto-repeat del teclado.                                                        |
| Los 5 carriles de río, todos con troncos, resultan repetitivos en partidas largas.                                                   | Aceptado a propósito: es la puerta de entrada de `03-dificultad-carriles.md`, que introduce variedad sin tocar este spec.                                                                          |
| El techo de `2.5×` puede sentirse arbitrario en niveles muy altos.                                                                   | Aceptado a propósito: es el comportamiento definido por este spec hasta que `03-dificultad-carriles.md` lo reemplace de forma explícita.                                                           |
| Reencajar `frog.x` a la grilla en cada salto podría "teletransportar" visiblemente a la rana si estaba muy desplazada por un tronco. | El reencaje usa el múltiplo de `CELL` más cercano; el desplazamiento máximo posible en un frame es pequeño (velocidad de tronco × dt), así que el salto visual es de a lo sumo unos pocos píxeles. |

## Qué **no** entra en este spec

- Sonido.
- Tortugas que se hunden y el techo de velocidad sin límite.
- Temporizador por vida.
- Cocodrilos, power-ups, mapas alternativos.
- Controles táctiles, modo dos jugadores.

Cada uno, si llega, va en su propio spec.
