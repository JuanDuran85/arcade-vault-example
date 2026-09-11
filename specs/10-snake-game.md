# SPEC 10 — Cuarto juego real: `snake`

> **Status:** Aprobado
> **Depends on:** SPEC 06, SPEC 07
> **Date:** 2026-09-11
> **Objective:** Diseñar y construir Snake desde cero en `lib/games/snake.ts` — sin `game.js` de referencia, con fruta real dibujada desde un sprite propio — registrarlo en el catálogo y en `registry.ts` para que `/juego/snake/jugar` sea una partida real que guarda puntuación.

---

## Por qué existe este spec

Es el cuarto juego y el primero **sin** `game.js` de referencia en `references/started-games/`: no hay nada que portar, la mecánica se diseña aquí. Lo que sí existe es un asset — `references/source-assets/snake-assets/fruits.png` y su atlas de coordenadas `sprites.js` (21 frutas, fila pixel-art) — que el usuario trajo explícitamente para este juego.

SPEC 08 había descartado los assets de `bloques` (spritesheet + 2 MP3) por el costo de un loader asíncrono y un estado "cargando" nuevo. Aquí la decisión es la contraria: un solo PNG pequeño, sin sonido ni animación, no justifica ese mismo rechazo. La solución que evita repetir el problema de SPEC 08: el `new Image()` se crea dentro de `start()` (igual que los `new Audio()` de SPEC 09 — el constructor no existe en el servidor) y mientras no ha cargado, la fruta se dibuja como un cuadrado verde de relleno. Cero campos nuevos en `GameState`, cero cambios en `jugar/client.tsx`: el contrato de `registry.ts` no se toca.

**id en inglés, rutas en español.** SPEC 01 había reservado el id `serpentina` (con su cover `cover-snake` sin usar). El usuario pidió el id `snake` en su lugar — la primera vez que un id del catálogo no está en español —, pero **no** renombrar la estructura de rutas del proyecto: sigue siendo `/juego/[id]/jugar`, solo que aquí `[id]` vale `snake`. Renombrar `app/juego/` → `app/games/` o `/salon-de-la-fama` → `/hall-of-fame` para los 4 juegos es un cambio estructural aparte, fuera de este spec. El cover, el color y la categoría del placeholder de SPEC 01 sí se reusan tal cual — son independientes del id.

## Scope

**In:**

- Migración `supabase/migrations/20260911000000_add_game_snake.sql` con el `insert` de la fila `snake`.
- `public/sprites/fruits.png` — copia de `references/source-assets/snake-assets/fruits.png`.
- `lib/games/snake.ts` — `startSnake(canvas, callbacks): GameHandle`, mismo contrato que `asteroids.ts`/`caida.ts`/`bloques.ts`, todo el estado dentro del closure de `start()`.
- Movimiento en grilla: canvas cuadrado `800×800`, celdas de `20px` (grid `40×40`), loop a paso fijo por acumulador de tiempo (no cada frame de rAF).
- Control por flechas (`↑ ↓ ← →`) **y** `WASD` como alternativa, con `preventDefault` en las flechas, bloqueando el giro que invierte la dirección actual en el mismo tick (no te puedes morder invirtiendo sobre ti mismo).
- Fruta: en cada spawn se elige al azar una de las 21 frutas del atlas (coordenadas portadas de `sprites.js`) y se dibuja con `drawImage` recortando `fruits.png`, cargado de forma asíncrona dentro de `start()`. Mientras la imagen no ha cargado, fallback a un cuadrado verde con `fillRect`.
- Comer fruta: `score += 10`, la serpiente crece un segmento, aparece fruta nueva en una celda libre al azar.
- Nivel: cada 50 puntos (5 frutas) sube el nivel y el intervalo de movimiento baja 10 ms (arranca en 150 ms, piso 60 ms).
- Fin de partida: tocar el borde del canvas o el propio cuerpo → `onGameOver(score)`, una sola vez (guarda `finished`). El modal genérico de fin de partida (nombre + `GUARDAR PUNTUACIÓN`) ya existe desde SPEC 06 y no necesita cambios.
- `GameState`: `lives` siempre `1` (mismo patrón que `caida`: el HUD pinta `VIDAS: 1` fijo; el fin de partida lo dispara `onGameOver`, no una caída de `lives` a `0`), `level` sí se reporta. **No se agrega ni se toca ningún campo de `registry.ts`.**
- HUD dentro del canvas (puntuación, nivel) duplicado a propósito con el HUD React, igual que los otros tres juegos.
- Entrada nueva en `lib/games/registry.ts` y su import: controles `"↑ ↓ ← → MOVER · WASD TAMBIÉN"`.
- Nota en la sección **Data & session** de `CLAUDE.md`.

**Out of scope (para specs futuros):**

- Sonido: ningún juego lo tiene salvo `bloques`, y no se pidió aquí.
- Wrap-around en los bordes: se descartó explícitamente, tocar el borde es game over.
- Power-ups, obstáculos, diseño de niveles con mapa propio — el "nivel" de `snake` es solo velocidad, no una estructura como `LEVELS` en `bloques`.
- Controles táctiles.
- Ocultar `VIDAS` del HUD para este juego en particular: exigiría volver `GameState.lives` opcional y tocar el HUD React compartido por los 4 juegos. Se resuelve reportando `lives = 1` fijo, igual que `caida`.
- Renombrar la estructura de rutas del proyecto (`app/juego` → `app/games`, `/jugar` → `/play`, `/salon-de-la-fama` → `/hall-of-fame`): decisión explícita del usuario de dejarlo fuera de este spec.
- Cambios a `lib/catalog.ts`, `lib/scores.ts`, el esquema de Supabase, `app/juego/[id]/layout.tsx` o `app/salon-de-la-fama/client.tsx` — genéricos por `game_id` desde SPEC 06. Esto incluye que `snake` aparezca como tab en el Salón de la Fama y que su sidebar liste el top 10: ya funciona solo, al insertar la fila en `games`.
- Una clase `.cover-*` nueva: se reusa `.cover-snake`, ya en `globals.css` sin usar desde SPEC 01.

## Data model

Fila exacta del catálogo:

```sql
insert into public.games (id, title, short, long, cat, cover, color) values
  ('snake', 'SNAKE', 'Come frutas, crece y no te muerdas la cola.',
   'Guía a la serpiente por el tablero comiendo frutas que aparezcan aleatoriamente. Cada fruta que comes hace crecer tu cuerpo y sube tu puntuación. La partida termina si chocas contra una pared o contra ti mismo.',
   'ARCADE', 'cover-snake', 'green');
```

`GameState` de `registry.ts` no cambia: `snake` reporta `score`, `lives` (constante `1`) y `level`; `lines` se queda sin definir.

Estado interno del juego, dentro del closure:

```ts
const CELL = 20;
const COLS = 40; // 800 / 20
const ROWS = 40; // 800 / 20 — tablero cuadrado

let snake: { x: number; y: number }[]; // cabeza en el índice 0
let dir: { x: number; y: number };
let nextDir: { x: number; y: number }; // buffer: el giro se aplica en el próximo tick
let fruit: { x: number; y: number; spriteIndex: number };
let score = 0;
let level = 1;
let moveInterval = 150; // ms; baja 10 por nivel, piso 60
let acc = 0; // acumulador de tiempo para el paso fijo
let finished = false;
```

Atlas de frutas (coordenadas de recorte, portadas de `references/source-assets/snake-assets/sprites.js`, fila pixel-art `y: 136`):

```ts
const FRUITS: { x: number; y: number; w: number; h: number }[] = [
  { x: 34, y: 136, w: 110, h: 160 }, // banana
  { x: 186, y: 136, w: 150, h: 160 }, // orange
  // ... las 21 entradas de sprites.js, mismo orden
];
```

## Implementation plan

1. Copiar `references/source-assets/snake-assets/fruits.png` a `public/sprites/fruits.png`. Escribir y aplicar `supabase/migrations/20260911000000_add_game_snake.sql` con `apply_migration`. Verificar con `list_tables` (4 filas en `games`) y `get_advisors` sin avisos nuevos. Comprobación manual: `/biblioteca` lista 4 tarjetas, el filtro ARCADE incluye SNAKE, `/juego/snake` deja de dar 404 (el botón JUGAR aún no funciona).
2. Crear `lib/games/snake.ts` con la estructura del módulo (closure, `FRUITS` portado, `start`/`stop`/`setPaused`/`endGame`, guarda `finished`), dibujando de momento solo la grilla `40×40` y la serpiente inicial sobre el canvas `800×800`. `npm run build` pasa.
3. Implementar el loop a paso fijo: un acumulador de `dt` dispara un "tick" de movimiento cada `moveInterval` ms; `requestAnimationFrame` sigue llamando a `draw()` en cada frame para que la pausa no deje el canvas en negro.
4. Controles: `keydown` en `window` escribe `nextDir` con `preventDefault` en las 4 flechas y sus equivalentes `WASD` (`W`=↑, `A`=←, `S`=↓, `D`=→), ignorando el giro que invierte la dirección actual. `stop()` quita el listener.
5. Colisiones y crecimiento: borde del canvas o cuerpo propio → `finished = true`, `onGameOver(score)` una sola vez. Comer fruta → crece un segmento, `score += 10`, cada 50 puntos `level++` y `moveInterval = max(60, 150 - (level - 1) * 10)`, nueva fruta en celda libre al azar con `spriteIndex` al azar.
6. Cargar el sprite: `new Image()` dentro de `start()`, `src = "/sprites/fruits.png"`. `draw()` usa `drawImage` recortando `FRUITS[fruit.spriteIndex]` si `img.complete`; si no, `fillRect` verde de fallback.
7. Cablear `onState` (se notifica cuando cambian `score` o `level`; `lives` siempre `1`) y `setPaused`/`endGame` igual que los otros juegos: `setPaused(true)` hace que el loop deje de avanzar el acumulador (el juego se congela) pero `draw()` se sigue llamando cada frame; al reanudar se reinicia `lastTime` para que `dt` no acumule el tiempo en pausa.
8. Añadir la entrada a `lib/games/registry.ts`: `snake: { start: startSnake, controls: "↑ ↓ ← → MOVER · WASD TAMBIÉN" }`.
9. Actualizar la sección **Data & session** de `CLAUDE.md`: cuarto juego real, primero diseñado desde cero (sin `started-games/` de referencia), primero con un id en inglés dentro de las rutas en español existentes, y primero en cargar un asset de imagen de forma asíncrona sin agregar estado nuevo al contrato de `registry.ts`.
10. Pasada manual (ver criterios de aceptación).

## Acceptance criteria

- [ ] `/juego/snake` existe, muestra la ficha del catálogo con el cover verde de `cover-snake` y su sidebar de leaderboard (top 10, igual que los otros juegos).
- [ ] En `/juego/snake/jugar` la serpiente se mueve con las flechas **y** con `WASD`, y no puede invertir dirección instantáneamente sobre sí misma.
- [ ] Comer una fruta suma exactamente 10 puntos, hace crecer la serpiente un segmento y aparece una fruta nueva dibujada con el sprite real (no un cuadrado) una vez cargada la imagen.
- [ ] Cada 50 puntos sube el nivel y la serpiente se mueve visiblemente más rápido; el HUD React y el del canvas muestran el mismo nivel.
- [ ] Tocar cualquier borde del canvas (tablero `40×40`) termina la partida.
- [ ] Chocar contra el propio cuerpo termina la partida.
- [ ] `PAUSA` congela el movimiento (el loop deja de avanzar) pero la serpiente y la fruta siguen visibles (no se queda en negro); `REANUDAR` no produce un salto de posición.
- [ ] El botón `FIN` termina la partida con la puntuación acumulada hasta ese momento, una sola vez, y abre el modal de fin de partida con el campo de nombre y `GUARDAR PUNTUACIÓN`.
- [ ] Pulsar las flechas o `WASD` durante la partida no hace scroll de la página.
- [ ] El HUD React muestra PUNTUACIÓN, VIDAS (fijo en 1) y NIVEL.
- [ ] La fila de controles bajo el CRT es `"↑ ↓ ← → MOVER · WASD TAMBIÉN"`.
- [ ] Terminar la partida guarda una puntuación real con `saveScore`, y aparece en el sidebar de `/juego/snake`, en su propio tab del Salón de la Fama (aparece solo, sin tocar `salon-de-la-fama/client.tsx`) y en el tab GLOBAL.
- [ ] Salir de la pantalla detiene el loop y quita el listener de teclado: volver a entrar no duplica el juego ni acelera la serpiente.
- [ ] `JUGAR DE NUEVO` empieza una partida nueva desde 0 puntos, nivel 1 y una serpiente de tamaño inicial.
- [ ] Un id que no está en `games` sigue devolviendo 404.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisions taken and discarded

- **Sí: diseñar desde cero, no portar.** No hay `game.js` de Snake en `references/started-games/`; el usuario lo confirmó al invocar la skill.
- **Sí: usar el sprite real de fruta.** Decisión explícita del usuario, a diferencia de SPEC 08 donde se descartaron los assets del original. Aquí el asset es un solo PNG sin animación ni sonido, mucho más liviano que el spritesheet + audio de `bloques`.
- **Sí: cargar la imagen con `new Image()` dentro de `start()`, sin agregar un campo `loading` a `GameState`.** Mientras carga, la fruta se dibuja como `fillRect` verde de fallback — el archivo es pequeño y el fallback dura como mucho un par de frames.
- **Sí: id `snake` (inglés), rutas sin cambios.** Decisión explícita del usuario. El cover, color y categoría del placeholder `serpentina` de SPEC 01 se reusan igual (son independientes del id); solo el id y el título cambian. Renombrar `app/juego/` → `app/games/` para los 4 juegos queda fuera, es un cambio estructural que el usuario decidió no incluir aquí.
- **Sí: canvas `800×800`, `CELL=20`, grid `40×40`.** Prioriza el "grid de 40×40" explícito del usuario sobre la mención de "celdas de 30px", que no encajaba con un canvas cuadrado de 800px (confirmado con el usuario).
- **Sí: `WASD` como alternativa a las flechas.** Pedido explícito; son 4 líneas extra en el mismo handler de `keydown`, sin tocar el resto del contrato.
- **Sí: `lives` siempre reporta `1`, el HUD lo pinta fijo.** Mismo patrón que `caida`. Se descartó volver `lives` opcional en `GameState` para "ocultar vidas" en snake: tocaría el HUD React compartido por los 4 juegos por una preferencia cosmética de uno solo.
- **Sí: game over al tocar el borde, no wrap-around.** Snake clásico, decisión explícita del usuario.
- **Sí: nivel + velocidad progresiva, reportando `level`.** Coincide con el pedido del usuario ("el nivel podría subir cada n frutas... para acelerar la serpiente") y con el patrón ya establecido por `rocas`/`caida`.
- **No: sonido.** Ningún otro juego lo tiene salvo `bloques`, y no se pidió aquí.
- **No: cambios a `GameState`/`GameCallbacks`/`GameHandle` en `registry.ts`.** `snake` cabe entera en los campos que ya existen (`score`, `lives`, `level`).

## Identified risks

| Riesgo                                                                                                                       | Mitigación                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El PNG no llega a cargar antes del primer frame con fruta y se ve el cuadrado verde más de un instante en conexiones lentas. | Aceptado: es un fallback visible pero no roto; el archivo es pequeño y se sirve desde `public/`.                                                          |
| El loop de paso fijo puede acumular error si `dt` varía mucho entre frames.                                                  | Acumulador estándar (`acc += dt; while (acc >= moveInterval) { tick(); acc -= moveInterval; }`), no pierde ni duplica ticks.                              |
| Bloquear el giro de 180° mal implementado deja que la serpiente se muerda a sí misma en el primer movimiento.                | Criterio de aceptación explícito; se compara `nextDir` contra la dirección opuesta a `dir` antes de aceptarlo.                                            |
| `WASD` y flechas mapean a la misma dirección; si un listener queda duplicado, un giro podría aplicarse dos veces por tick.   | Ambos esquemas escriben la misma variable `nextDir`, nunca disparan `tick()` directamente: el paso fijo del loop consume el buffer una vez por intervalo. |
| Coordenadas del atlas portadas a mano desde `sprites.js` pueden tener un desfase de recorte.                                 | `sprites.js` ya trae los rects verificados por análisis de píxeles (comentario propio del archivo); se copian tal cual, sin recalcular.                   |

## Qué **no** entra en este spec

- Sonido.
- Wrap-around en los bordes.
- Power-ups, obstáculos, niveles con mapa propio.
- Controles táctiles.
- Ocultar `VIDAS` del HUD (requiere volver `lives` opcional en `registry.ts`, afecta a los 4 juegos).
- Renombrar la estructura de rutas del proyecto a inglés.

Cada uno, si llega, va en su propio spec.
