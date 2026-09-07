# SPEC 08 — Tercer juego real: `bloques` (Arkanoid)

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-09-06
> **Objective:** Portar el Arkanoid de `references/started-games/04-arkanoid/` a `lib/games/bloques.ts`, registrarlo y darle su fila en el catálogo, para que `/juego/bloques/jugar` sea una partida real que guarda puntuación.

---

## Por qué existe este spec

Es el tercer juego y el primero que llega con assets: el original dibuja con un spritesheet PNG y suena con dos MP3. `rocas` y `caida` son vectores puros sin ningún archivo en `public/`, y su loop arranca síncrono. Copiar el spritesheet metería un loader asíncrono y un estado "cargando" que ninguna otra pantalla tiene, a cambio de un aspecto que además no es el del CRT del resto de la plataforma. Este spec porta la **mecánica** verbatim (físicas, colisiones, niveles, puntuación) y redibuja las **formas** con `fillRect`. El resto del camino ya está hecho: `registry.ts` existe desde SPEC 07 y el leaderboard es genérico por `game_id` desde SPEC 06.

También es el primero que llega con **ratón**, y eso rompe una suposición que los dos ports anteriores no tenían que plantearse: en `rocas` y `caida` toda mutación del estado ocurre dentro de `update()`, así que "pausar = no llamar a `update()`" congela el juego entero. Aquí no. El `mousemove` del original escribe `paddle.x` directamente desde el handler, fuera del loop; portado tal cual, la paleta se seguiría moviendo durante la pausa y después del fin de partida. Ver **Reglas de port** más abajo.

### Reglas de port heredadas de SPEC 05 y SPEC 07

No se vuelven a discutir; se aplican. Se listan porque son la diferencia entre un port que encaja en la plataforma y uno que la pelea:

1. **Todo el estado dentro del closure de `start()`.** Nada de variables de módulo: dos montajes compartirían paleta y bola.
2. **El juego no escribe en el DOM ni en `localStorage`.** Ni overlays propios, ni botones, ni ranking local.
3. **La pausa es de la plataforma**, por `handle.setPaused()`. Ninguna tecla del juego pausa.
4. **En pausa se sigue dibujando**: `loop()` llama a `draw()` y salta `update()`. Congelar también el dibujo dejaría el canvas en negro.
5. **Al reanudar se reinicia `lastTime`**, para que `dt` no acumule el tiempo en pausa y la bola no salte media pantalla.
6. **`onGameOver` se emite una sola vez por partida**, con una guarda interna.
7. **Todos los listeners se quitan en `stop()`**, sin excepción.
8. **HUD duplicado a propósito**: el del canvas coexiste con el HUD React.

### Lo que funciona solo, sin escribir código

Consecuencia de insertar la fila en `games` y de llamar a `saveScore`. Se lista para que nadie lo implemente por segunda vez:

- El modal de fin de partida que pide el nombre y guarda en Supabase ya es genérico por `id` en `app/juego/[id]/jugar/client.tsx`.
- La barra lateral de `/juego/bloques` llama a `topScores(supabase, { gameId: id, limit: 10 })` desde SPEC 06.
- El Salón de la Fama construye sus tabs desde las filas de `games`: `BLOQUES` aparece solo, y sus puntuaciones entran también en el tab `GLOBAL`.
- El HUD React etiqueta PUNTUACIÓN, VIDAS y NIVEL desde SPEC 07, y omite LÍNEAS porque `bloques` no reporta ese campo.

## Scope

**In:**

- Migración `supabase/migrations/20260906010000_add_game_bloques.sql` con el `insert into public.games` de la fila `bloques`. No toca el esquema ni las migraciones anteriores.
- `lib/games/bloques.ts` — `startBloques(canvas, callbacks): GameHandle`, mismo contrato que `asteroids.ts` y `caida.ts`, con todo el estado dentro del closure de `start()`.
- Los 5 niveles de `references/started-games/04-arkanoid/levels.js` copiados tal cual dentro del módulo (mismo patrón que `caida.ts`: un solo archivo, sin módulo aparte).
- Render con `fillRect`: bloques, paleta y bola como rectángulos de color; explosión como un rectángulo que se desvanece durante `EXPLOSION_DURATION`.
- HUD dentro del canvas (score, nivel, vidas), duplicado a propósito con el HUD React, igual que los otros dos juegos.
- Controles `←`/`→` y ratón (`mousemove` sobre el canvas), con `preventDefault` en las flechas y **ambos listeners retirados en `stop()`**.
- Una entrada nueva en `lib/games/registry.ts` y su import. `GameState`, `GameCallbacks` y `GameHandle` no cambian.
- Nota en la sección **Data & session** de `CLAUDE.md`.

**Out of scope (para specs futuros):**

- El spritesheet `spritesheet-breakout.png` y los helpers de `assets/spritesheet.js`. Decisión explícita del usuario: nada en `public/`, nada asíncrono.
- Sonido (`ball-bounce.mp3`, `break-sound.mp3`). Ninguna pantalla de la plataforma emite audio; igual que decidió SPEC 05.
- El overlay de pausa propio del original, su listener `canvas.click` y sus botones de salto de nivel 1-5, junto con la tecla `P`/`Escape` y las constantes `PAUSE_BTN_*`. La pausa es de la plataforma vía `handle.setPaused()`, como en SPEC 07.
- El overlay `GAME OVER` / `¡Completaste el juego!` que dibuja `drawOverlay()`: el modal lo pone la plataforma.
- Un estado `won` en `GameState` y un modal de victoria distinto: completar el nivel 5 emite `onGameOver` con la puntuación real, sin concepto nuevo.
- Cambios en `lib/catalog.ts`, `lib/scores.ts`, el esquema de Supabase, `app/juego/[id]/layout.tsx` y `app/salon-de-la-fama/client.tsx` — genéricos por `game_id` desde SPEC 06.
- Una clase `.cover-*` nueva: se reusa `.cover-bricks`, que ya está en `app/globals.css` sin usar desde SPEC 01.
- Controles táctiles, remapeo de teclas, niveles nuevos, power-ups.

## Data model

Ninguna estructura persistida nueva. La fila exacta del catálogo:

```sql
insert into public.games (id, title, short, long, cat, cover, color) values
  ('bloques', 'BLOQUES', 'Rompe el muro sin que la bola te pase de largo.',
   'Cinco muros, cada uno más rápido que el anterior. La paleta responde a las flechas o al ratón, la bola rebota con el ángulo que le des, y cada bloque que revienta vale diez puntos. Tres vidas, ni una más.',
   'ARCADE', 'cover-bricks', 'magenta');
```

`GameState` de `registry.ts` no cambia: `bloques` reporta `score`, `lives` y `level`, los tres campos que ya existen (`lines` se queda sin definir, así el HUD no lo pinta).

Estado interno del juego, dentro del closure (portado del original):

```ts
const paddle = { x: 0, y: 560, w: 81, h: 14 };
const ball = { x: 0, y: 0, w: 16, h: 16, vx: 200, vy: -300 };
let blocks: Block[]; // { x, y, w, h, color, alive }
let explosions: Explosion[]; // { x, y, w, h, color, elapsed }
let lives = 3;
let score = 0;
let currentLevel = 1;
```

Constantes del original que se conservan sin tocar: canvas `800×600`, `PADDLE_SPEED = 400`, rejilla `10×6` de bloques `64×24`, `BASE_BALL_VX = 200`, `BASE_BALL_VY = -300`, y los multiplicadores de velocidad por nivel `[1.00, 1.10, 1.21, 1.33, 1.46]`. El buffer de `800×600` es el mismo que `rocas` y `caida`, así que la clase `.game-canvas` (`aspect-ratio: 4/3`) sirve sin tocar el CSS.

### Entrada: teclado y ratón

El original tiene **tres** listeners; solo dos se portan.

| Listener original                | En el port                                                               |
| -------------------------------- | ------------------------------------------------------------------------ |
| `document.keydown` / `keyup`     | Se registran en `window`, con `preventDefault` en `←`/`→`                |
| `canvas.mousemove`               | Se conserva, con la guarda de abajo                                      |
| `canvas.click` (saltar de nivel) | **No se porta**: es depuración y colisiona con la pausa de la plataforma |

Del `keydown` se elimina además la rama de `P`/`Escape`. Los tres listeners que sobreviven (`keydown`, `keyup`, `mousemove`) se retiran en `stop()`.

### La paleta y la pausa

Este es el único punto donde el port **no** puede ser verbatim. En el original, `mousemove` escribe `paddle.x` directamente desde el handler:

```js
// original: mueve la paleta pase lo que pase
paddle.x = Math.max(
  0,
  Math.min(canvas.width - paddle.w, mouseX - paddle.w / 2),
);
```

Como esa asignación vive fuera de `update()`, la regla de SPEC 07 ("en pausa no se llama a `update()`") no la alcanza: la paleta se movería con el ratón durante la pausa y también después del fin de partida. El handler pasa a salir temprano si el juego no está corriendo:

```ts
if (paused || finished) return;
```

La misma guarda que `update()` ya aplica con su `if (gameState !== 'playing') return`. El teclado no necesita nada: `keydown` solo marca banderas y es `update()` quien las lee.

### Fin de partida

Tres caminos, un solo evento:

| Camino                       | Original                           | Port                                     |
| ---------------------------- | ---------------------------------- | ---------------------------------------- |
| 0 vidas                      | `gameState = 'gameover'` + overlay | `onGameOver(score)`                      |
| Completar el nivel 5         | `gameState = 'win'` + overlay      | `onGameOver(score)`                      |
| Botón `FIN` de la plataforma | no existe                          | `handle.endGame()` → `onGameOver(score)` |

Una guarda interna (`finished`) asegura que el evento se emite **una sola vez por partida**: sin ella, pulsar `FIN` justo cuando cae la última vida abriría el modal dos veces o guardaría dos puntuaciones. El juego no dibuja ningún overlay en ninguno de los tres casos.

## Implementation plan

1. Escribir `supabase/migrations/20260906010000_add_game_bloques.sql` con el `insert` de arriba y aplicarlo con `apply_migration` del MCP de Supabase. Verificar con `list_tables` que `public.games` tiene tres filas y con `get_advisors` que no aparecen avisos nuevos. Comprobación manual: `/biblioteca` lista tres tarjetas, el filtro ARCADE muestra `BLOQUES` y `/juego/bloques` deja de dar 404 (el botón JUGAR todavía no funciona).
2. Crear `lib/games/bloques.ts` con la estructura del módulo (closure, `start`, `stop`, `setPaused`, `endGame`, guarda `finished`) y el `LEVELS` copiado de `levels.js`, dibujando de momento solo el fondo. `npm run build` pasa.
3. Portar `update(dt)` verbatim: paleta, movimiento de la bola, rebotes contra paredes y paleta, colisión AABB con bloques (+10 puntos, un bloque por frame), avance de nivel al vaciar el muro, pérdida de vida al salir la bola por abajo. Las llamadas a `bounceSound`/`breakSound` se borran; no se declara ningún `new Audio()`.
4. Registrar los listeners: `keydown`/`keyup` en `window` con `preventDefault` en `←`/`→` (sin la rama `P`/`Escape`), y `mousemove` en el canvas con la guarda `if (paused || finished) return`. `stop()` retira los tres. El listener `canvas.click` del salto de nivel no se porta.
5. Portar `draw()` sustituyendo cada `drawSprite`/`drawFrame` por `fillRect`, y dibujar el HUD dentro del canvas (PUNTUACIÓN, NIVEL, vidas). Las explosiones se dibujan como el rectángulo del bloque con `globalAlpha` decreciente según `elapsed / EXPLOSION_DURATION`. `drawOverlay()` y `drawPauseOverlay()` no se portan.
6. Cablear el loop y los callbacks: `onState` solo cuando cambie `score`, `lives` o `level` respecto al frame anterior; `onGameOver(score)` una sola vez (guarda `finished`) por los tres caminos de la tabla de arriba. `setPaused(true)` sigue llamando a `draw()` pero salta `update(dt)`, y al reanudar reinicia `lastTime`.
7. Añadir la entrada a `lib/games/registry.ts`:
   `bloques: { start: startBloques, controls: "← → MOVER PALETA · O MUEVE EL RATÓN" }`.
8. Actualizar la sección **Data & session** de `CLAUDE.md`: tres juegos reales, y que `bloques` es el primero que redibuja los sprites del original con rects y el primero con ratón (de ahí la guarda del handler).
9. Pasada manual (ver criterios de aceptación).

## Acceptance criteria

- [ ] `/juego/bloques` existe, muestra la ficha del catálogo con el cover de ladrillos y su sidebar de leaderboard.
- [ ] En `/juego/bloques/jugar` la paleta se mueve con `←`/`→` **y** siguiendo el ratón sobre el canvas.
- [ ] Romper un bloque suma exactamente 10 puntos y deja una explosión que se desvanece.
- [ ] Vaciar el muro carga el nivel siguiente con la bola más rápida; el HUD React y el del canvas muestran el mismo nivel.
- [ ] Perder la bola por abajo resta una vida; a las 3 se acaba la partida.
- [ ] Completar el nivel 5 termina la partida igual que perder: mismo modal, con la puntuación real.
- [ ] `PAUSA` congela el juego pero el muro, la paleta y la bola siguen visibles (no se queda en negro); `REANUDAR` no produce un salto de tiempo: la bola no aparece media pantalla más allá.
- [ ] **Con el juego en pausa, mover el ratón no mueve la paleta.** Tampoco la mueve después del fin de partida.
- [ ] Pulsar `P` o `Escape` no hace nada, y no aparece ningún overlay de pausa ni de nivel dentro del canvas.
- [ ] El botón `FIN` acaba en el mismo modal, con la puntuación acumulada hasta ese momento. Pulsarlo justo al perder la última vida abre el modal **una sola vez** y guarda una sola puntuación.
- [ ] El juego no dibuja ningún overlay propio de `GAME OVER`, victoria o pausa.
- [ ] Pulsar las flechas durante la partida no hace scroll de la página.
- [ ] El HUD React muestra PUNTUACIÓN, VIDAS y NIVEL, y **no** LÍNEAS.
- [ ] La fila de controles bajo el CRT es la de `bloques` y no menciona ninguna tecla de pausa.
- [ ] Terminar la partida guarda una puntuación real con `saveScore`, y esa puntuación aparece en el sidebar de `/juego/bloques`, en su tab del Salón de la Fama y en el tab GLOBAL, sin haber tocado `layout.tsx` ni `salon-de-la-fama/client.tsx`.
- [ ] Salir de la pantalla detiene el `requestAnimationFrame` y quita los tres listeners: volver a entrar no duplica el juego, la paleta no va al doble de velocidad, y ni las flechas ni el ratón siguen respondiendo fuera de la pantalla de juego.
- [ ] `JUGAR DE NUEVO` empieza una partida nueva desde el nivel 1, con 0 puntos y 3 vidas.
- [ ] `grep` limpio de `localStorage`, `document.` y `new Audio` en `lib/games/bloques.ts`, y ningún archivo nuevo en `public/`.
- [ ] `/juego/rocas/jugar` y `/juego/caida/jugar` se juegan exactamente igual que antes de este spec.
- [ ] Un id que no está en `games` sigue devolviendo 404.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisions taken and discarded

- **Sí: portar la mecánica, redibujar las formas.** El original ya está probado y sus físicas no se tocan; lo único que cambia es la llamada de dibujo. Ahorra un PNG en `public/`, el módulo `spritesheet.js`, un loader asíncrono y un estado "cargando" que rompería el patrón síncrono de `rocas` y `caida`.
- **No: el spritesheet ni el sonido.** Tres assets nuevos para un aspecto que además no es el del CRT del resto de la plataforma.
- **Sí: el registry ya existe.** Lo creó SPEC 07; este spec solo añade una entrada y un import.
- **Sí: reusar `.cover-bricks`.** La clase existe, está sin usar desde SPEC 01 y el motivo son literalmente ladrillos. CSS nuevo: cero.
- **Sí: ganar emite `onGameOver`.** "Terminar la partida" ya es un evento del contrato; un estado `won` obligaría a tocar `registry.ts`, `client.tsx` y los dos juegos existentes para una sola palabra del modal.
- **No: ciclar los niveles tras el 5.** Cambiaría la mecánica del original sin que nadie lo haya pedido.
- **Sí: conservar el control por ratón.** Son cuatro líneas y es el control natural del género.
- **No: el overlay de pausa del original.** Son botones de depuración para saltar de nivel, y colisionan con la pausa de la plataforma. Con ellos se va también el listener `canvas.click`.
- **Sí: guardar el handler del ratón con `if (paused || finished) return`.** Es la única desviación del port verbatim, y no es una preferencia: sin ella la regla de pausa de SPEC 07 no cubre este juego, porque el `mousemove` muta `paddle.x` fuera de `update()`. Descartado en su lugar mover la lectura del ratón dentro de `update()` guardando la última posición del cursor — es más código y cambia la latencia del control por un empate.
- **Sí: guarda `finished` para emitir `onGameOver` una sola vez.** Aquí importa más que en `caida`: hay tres caminos al fin de partida (0 vidas, nivel 5 completado, botón `FIN`) en vez de dos.
- **No: `new Audio()` a nivel de módulo.** Además de que el sonido queda fuera, ese constructor se ejecutaría al importar el módulo y `lib/games/bloques.ts` acaba en el grafo de un Server Component.

## Identified risks

| Riesgo                                                                                                                 | Mitigación                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Sin sprites, los bloques quedan rectángulos planos y el juego se ve más pobre que el original.                         | Los colores son los del CRT (`#ff006e`, `#f5ff00`, `#00f5ff`, `#00ff88`) y la explosión mantiene su animación. Se juzga en la pasada manual. |
| El `mousemove` se registra en el canvas y el `keydown` en `window`; si `stop()` no quita ambos, dos montajes se suman. | Mismo criterio de aceptación que en SPEC 05: salir y volver no acelera la paleta. StrictMode en desarrollo lo provoca a propósito.           |
| Un bloque por frame (`break` tras la primera colisión) puede dejar la bola atravesando dos bloques a velocidad alta.   | Es el comportamiento del original y se porta tal cual. Cambiarlo es una mejora de físicas, no un port.                                       |
| La guarda del `mousemove` se olvida: en pausa la paleta parece "responsiva" y el fallo pasa por normal.                | Criterio de aceptación propio y explícito, porque ningún otro criterio lo detecta y ningún juego anterior tenía este caso.                   |
| `FIN` y la última vida coinciden, `onGameOver` se emite dos veces y se guardan dos filas en `scores`.                  | Guarda `finished`, con su propio criterio. Mismo riesgo que identificó SPEC 07, con un camino más (la victoria del nivel 5).                 |
| El estado del juego (`gameState`, `paused`, `finished`) queda repartido en tres banderas y se contradicen.             | `paused` y `finished` son los únicos añadidos; `gameState` conserva `'playing'`/`'gameover'`/`'win'` del original solo para `update()`.      |

## Qué **no** entra en este spec

- Spritesheet y sonido.
- Overlay de pausa, overlay de fin de partida y salto de nivel del original.
- La tecla `P`/`Escape` y cualquier segunda fuente de verdad para la pausa.
- Un estado de victoria distinto del fin de partida.
- Niveles nuevos, power-ups, controles táctiles.

Cada uno, si llega, va en su propio spec.
