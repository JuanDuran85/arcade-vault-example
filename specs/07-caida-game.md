# SPEC 07 — Segundo juego real: Tetris en `/juego/caida/jugar`

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-09-06
> **Objective:** Portar el Tetris de `references/started-games/03-tetris/game.js` a `lib/games/caida.ts`, darle su fila en `public.games` y, al ser el segundo juego real, sustituir el import fijo de Asteroids por un registry `id → juego`.

---

## Por qué existe este spec

SPEC 05 dejó escrito que el registry `id → juego` se escribiría "cuando exista el segundo juego y se sepa qué tienen realmente en común". Este es ese momento, y la respuesta ya no es teórica.

**Todos los juegos de la plataforma tienen vidas.** `caida` tiene exactamente **una**: cuando la pierde, la partida se acabó, no hay reaparición. Así que `score` y `lives` son obligatorios en el estado de cualquier juego, y lo que varía es el resto (`level` en los dos, `lines` solo en `caida`). El fin de partida tampoco es un campo: es un **evento**, `onGameOver(finalScore)`, y el juego lo emite una sola vez.

El resto de la plataforma no necesita nada: desde SPEC 06 el catálogo, el leaderboard lateral (top 10) y el Salón de la Fama son genéricos por `game_id`. Añadir un juego es una fila, un módulo y una entrada en un mapa.

### Lo que funciona solo, sin escribir código

Estas tres cosas son consecuencia de insertar la fila en `games` y de llamar a `saveScore`. Se listan aquí para que nadie las implemente por segunda vez:

- El modal de fin de partida que pide el nombre y guarda en Supabase ya está en `app/juego/[id]/jugar/client.tsx` y es genérico por `id`.
- La barra lateral de `/juego/caida` llama a `topScores(supabase, { gameId: id, limit: 10 })` desde SPEC 06 — mismo top 10 que `rocas`.
- El Salón de la Fama construye sus tabs a partir de las filas de `games`: `CAÍDA` aparece sola en cuanto exista la fila, y sus puntuaciones entran también en el tab `GLOBAL`.

## Scope

**In:**

- `supabase/migrations/20260906000000_add_game_caida.sql` — un `insert into public.games` con la fila `caida`. No toca el esquema de SPEC 06.
- `lib/games/caida.ts` — `references/started-games/03-tetris/game.js` portado casi verbatim a `startCaida(canvas, { onState, onGameOver }): GameHandle`, tipado para TypeScript `strict`.
- **El HUD del juego se conserva tal cual está** (PUNTUACIÓN, LÍNEAS, NIVEL y el panel SIGUIENTE), dibujado dentro del canvas a la derecha del tablero, con el mismo contenido y el mismo orden que el original. Coexiste a propósito con el HUD React de la plataforma, igual que decidió SPEC 05 con el `drawHUD()` de Asteroids.
- Fin de partida como **evento**: donde el original llamaba a `endGame()` para pintar su overlay, el port llama a `onGameOver(finalScore)` y no dibuja nada. El modal React de la plataforma toma el control desde ahí.
- Pausa controlada **solo** por la plataforma: el componente recibe un prop `paused: boolean` y lo propaga al juego; con `paused === true` el loop sigue llamando a `draw()` pero no a `update()` ni al auto-drop.
- `lib/games/registry.ts` — los tipos `GameState` / `GameHandle` compartidos y el mapa `GAMES` con las dos entradas (`rocas`, `caida`).
- `lib/games/asteroids.ts` — pasa a usar `GameState`/`GameHandle` del registry en vez de `AsteroidsState`/`AsteroidsHandle`, y a emitir `onGameOver(score)` en lugar de reportar `gameOver: true` en su estado. Ningún otro cambio de lógica.
- `app/juego/[id]/jugar/client.tsx` — deja de importar `startAsteroids`; lee la entrada por `id` del registry. El HUD y la fila de controles pasan a depender del juego, y el fin de partida llega por `onGameOver` en vez de por el estado.
- Reutilizar la clase `.cover-tetro` que ya existe en `app/globals.css`, huérfana desde SPEC 06. **No se escribe CSS nuevo.**
- Nota en la sección **Data & session** de `CLAUDE.md`.

**Out of scope (para specs futuros):**

- Cualquier cambio a `lib/catalog.ts`, `lib/scores.ts`, el esquema de Supabase (`games`/`scores`/`game_stats`), `app/juego/[id]/layout.tsx` o `app/salon-de-la-fama/client.tsx`: son genéricos por `game_id` desde SPEC 06 y no se tocan.
- El tercer juego (`references/started-games/04-arkanoid`).
- El tema claro/oscuro y el botón `#theme-toggle` del Tetris original: la plataforma tiene su propio CRT y una sola estética. Las ~25 líneas finales de `game.js` (`applyTheme`, `localStorage["tetris-theme"]`) no se portan.
- **Todo el overlay HTML del original y cualquier leaderboard local**: el overlay de GAME OVER y de PAUSA, el botón `#restart-btn` y todo uso de `localStorage` desde el juego. La plataforma ya tiene modal, botones y un leaderboard real en Supabase; duplicarlos daría dos rankings que nunca coinciden.
- **La tecla `P` (y `Esc`) como pausa del juego**: la pausa la controla solo la plataforma, por el prop `paused`. Dos fuentes de verdad para lo mismo se desincronizan.
- **Vidas múltiples o reaparición en `caida`**: tiene una vida, y perderla termina la partida. Un sistema de vidas para Tetris sería inventar mecánica que el juego de origen no tiene.
- Sonido, controles táctiles, mandos y remapeo de teclas — igual que decidió SPEC 05.
- Guardado de piezas (_hold_), bolsa de 7 (_7-bag randomizer_), _lock delay_ y rotación SRS: el original usa `Math.random()` puro y patadas `[0,±1,±2]`. Se porta lo que hay.
- Ajustar la paleta del juego (los 8 colores de pieza) a las variables del CRT.
- Recordar el juego preferido, continuar una partida, o cualquier estado de partida persistido.

## Data model

### Fila en `public.games`

```sql
insert into public.games (id, title, short, long, cat, cover, color) values
  ('caida', 'CAÍDA', 'Encaja las piezas antes de que te sepulten.',
   'Las piezas bajan cada vez más rápido y solo desaparecen cuando completas una línea entera. Entre ellas se cuela una tuerca con un agujero en el centro que no encaja con nada: colócala donde menos estorbe.',
   'PUZZLE', 'cover-tetro', 'cyan');
```

`cat` y `color` son los únicos valores que aceptan los `check` de la tabla. `cover-tetro` ya existe en `app/globals.css` (motivo de tetriminó sobre degradado morado) y no la usa nadie.

### `lib/games/registry.ts`

```ts
export interface GameState {
  score: number;
  lives: number; // todos los juegos tienen vidas; caida siempre reporta 1
  level?: number; // rocas, caida
  lines?: number; // caida
}

export interface GameCallbacks {
  onState: (state: GameState) => void;
  onGameOver: (finalScore: number) => void; // se emite una sola vez por partida
}

export interface GameHandle {
  stop(): void; // cancela el rAF y quita los listeners de teclado
  setPaused(paused: boolean): void;
  endGame(): void; // fuerza el fin de partida; acaba emitiendo onGameOver
}

interface GameEntry {
  start(canvas: HTMLCanvasElement, callbacks: GameCallbacks): GameHandle;
  controls: string; // fila de controles bajo el marco CRT
}

export const GAMES: Record<string, GameEntry> = {
  rocas: {
    start: startAsteroids,
    controls: "← → ROTAR · ↑ PROPULSAR · ESPACIO DISPARAR",
  },
  caida: {
    start: startCaida,
    controls: "← → MOVER · ↑ ROTAR · ↓ BAJAR · ESPACIO SOLTAR",
  },
};
```

`score` y `lives` son obligatorios porque los tienen todos los juegos. Los demás son opcionales **con nombre propio**, no un `Record<string, number>` genérico: el HUD necesita saber qué etiqueta poner a cada número, y con nombres reales lo comprueba el compilador.

`GameState` **no** tiene `gameOver`. El fin de partida viaja por `onGameOver(finalScore)` y por ningún otro sitio: un campo de estado más un evento serían dos canales para lo mismo, que es exactamente como se desincronizan.

### Estado de Tetris

El port reporta `{ score, lives: 1, level, lines }`. Los valores salen tal cual del original:

- `LINE_SCORES = [0, 100, 300, 500, 800]`, multiplicado por `level`.
- Caída dura: `+2` por celda recorrida. Caída suave: `+1` por fila.
- `level = floor(lines / 10) + 1`; `dropInterval = max(100, 1000 − (level − 1) × 90)` ms.
- `lives` es `1` durante toda la partida. No baja a `0`: perderla **es** el fin de partida.

### Fin de partida

La condición es la del original: en `spawn()`, la pieza recién generada colisiona ya en la fila de arriba. Lo que cambia es qué pasa entonces.

| Original (`game.js`)                               | Port (`lib/games/caida.ts`)                        |
| -------------------------------------------------- | -------------------------------------------------- |
| `endGame()` pinta el overlay HTML y escribe el DOM | `onGameOver(score)` y nada más; no dibuja overlay  |
| Ranking propio en `localStorage`                   | Se borra: la puntuación va a `public.scores`       |
| `#restart-btn` reinicia con `init()`               | `JUGAR DE NUEVO` del modal React remonta el canvas |

El modal de la plataforma toma el control desde ahí: pide el nombre, llama a `saveScore(supabase, { gameId: "caida", name, score })` y muestra `▸ PUNTUACIÓN GUARDADA_`. Es el mismo modal que usa `rocas`, sin cambios.

> El `game.js` de origen no tiene literalmente un `#gameover-overlay` ni un leaderboard en `localStorage`: usa un `#overlay` compartido entre PAUSA y GAME OVER, y el único `localStorage` que toca es `"tetris-theme"`. La instrucción es la misma en los dos casos — **el port no escribe en el DOM ni en `localStorage`, punto** — pero conviene saber qué se va a encontrar al abrir el archivo.

### Pausa

La plataforma es la única fuente de verdad. `app/juego/[id]/jugar/client.tsx` ya tiene el estado `paused` y el botón `PAUSA`/`REANUDAR`; el componente del canvas recibe `paused: boolean` como prop y un `useEffect` lo propaga con `handle.setPaused(paused)`.

Dentro del juego, `paused === true` significa: `loop()` sigue llamando a `draw()` (el tablero se ve congelado, no en negro) y **no** llama a `update()` ni al auto-drop. Al reanudar se reinicia `lastTime` para que `dropAccum` no acumule el tiempo en pausa y la pieza no caiga varias filas de golpe.

Las teclas `P` y `Esc` del original **se desactivan**. El `togglePause()` de `game.js` no se porta.

### Teclado

Los listeners de `keydown` se registran en `window` al arrancar y **se quitan en `stop()`**, sin excepción: el `useEffect` que monta el canvas llama a `stop()` en su limpieza. Es lo que impide que salir y volver a entrar deje dos juegos escuchando la misma tecla, y StrictMode en desarrollo monta dos veces a propósito para sacarlo a la luz.

Se llama a `e.preventDefault()` en `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown` y `Space`, para que jugar no scrollee la página.

### Geometría del canvas

Un solo `<canvas>` de **800×600**, el mismo buffer que Asteroids, para que la clase `.game-canvas` existente (`aspect-ratio: 4/3`) sirva sin tocar el CSS.

- Tablero: 10×20 celdas de 30 px = 300×600, dibujado **centrado**, en `x = 250`.
- HUD del juego + panel SIGUIENTE: dibujados a la derecha del tablero, a partir de `x = 580`, con su propio desfase vertical — deliberadamente **sin alinear** con el borde superior del tablero. Contenido y orden idénticos al sidebar del original: PUNTUACIÓN, LÍNEAS, NIVEL y la pieza siguiente.

El origen usaba dos elementos `<canvas>` (`#board` y `#next-canvas`) más un sidebar HTML; aquí los tres se dibujan en el mismo contexto 2D, para que la firma del registry siga siendo `start(canvas, callbacks)`.

## Implementation plan

1. Crear `supabase/migrations/20260906000000_add_game_caida.sql` con el `insert` de arriba y aplicarlo con el MCP de Supabase (`apply_migration`). Verificar con `list_tables` que `public.games` tiene dos filas y con `get_advisors` que no aparecen avisos nuevos. Comprobación manual: `/biblioteca` ya lista dos tarjetas y `/juego/caida` deja de dar 404 (el botón JUGAR todavía no funciona).
2. Crear `lib/games/registry.ts` con `GameState`, `GameCallbacks`, `GameHandle` y `GAMES` conteniendo **solo** `rocas`. Adaptar `lib/games/asteroids.ts` a la firma nueva: usa los tipos del registry, recibe `{ onState, onGameOver }` y emite `onGameOver(score)` donde antes reportaba `gameOver: true`. `jugar/client.tsx` lee `GAMES[id]` en vez de importar `startAsteroids`, y abre el modal desde `onGameOver` en vez de desde el estado. Este paso no añade juegos: deja el sistema idéntico sobre la estructura nueva. Comprobación manual: `/juego/rocas/jugar` se juega y se guarda exactamente igual que antes.
3. Generalizar el HUD, la pausa y la fila de controles en `jugar/client.tsx`: guardar el `GameState` completo en un solo `useState`; VIDAS y PUNTUACIÓN se pintan siempre, NIVEL y LÍNEAS solo cuando ese campo venga definido. El componente del canvas pasa a recibir `paused: boolean` como prop, con un `useEffect` que llama a `handle.setPaused(paused)`. La fila bajo el CRT muestra `GAMES[id].controls`. `restart()` limpia el estado al objeto inicial en vez de a `{0, 3, 1}` fijos. Comprobación manual: `rocas` sigue mostrando PUNTUACIÓN / VIDAS / NIVEL y pausando igual.
4. Escribir `lib/games/caida.ts`: portar `game.js` envolviendo todo el estado dentro de `startCaida`. Cambios mínimos y solo los necesarios:
   - `canvas`/`ctx` vienen del argumento; el panel SIGUIENTE y el HUD del juego se dibujan en ese mismo contexto, desplazados a la derecha del tablero.
   - `updateHUD()` deja de escribir en el DOM: compara `{score, lives: 1, level, lines}` con lo último notificado y llama a `onState` solo si difiere.
   - `endGame()` **se elimina**. Donde `spawn()` detecta que la pieza nueva ya colisiona, se llama a `onGameOver(score)` y se para el loop. Sin overlay, sin `localStorage`, sin tocar el DOM.
   - El overlay de PAUSA y de GAME OVER, `#restart-btn`, `togglePause()` y las teclas `P`/`Esc` no se portan.
   - `drawGrid()` deja de leer `--grid-line` de `document.body` y usa un color literal.
   - Los listeners de `keydown` se registran en `window`, llaman a `e.preventDefault()` en `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown` y `Space`, y se quitan en `stop()`.
   - `setPaused(true)` hace que `loop()` siga dibujando pero salte `update()` y el auto-drop; al reanudar reinicia `lastTime` para que `dropAccum` no dé un salto.
   - `handle.endGame()` (botón `FIN`) emite `onGameOver(score)` por el mismo camino, conservando la puntuación.
   - `themeToggle` y todo lo relacionado con el tema no se portan.
5. Añadir la entrada `caida` a `GAMES` en el registry. Un import, cuatro líneas.
6. Actualizar `CLAUDE.md` (sección **Data & session**): hay dos juegos reales, existe `lib/games/registry.ts` y es donde se da de alta un juego nuevo.
7. Pasada manual completa (ver acceptance criteria).

## Acceptance criteria

- [X] `npm run lint` y `npm run build` terminan sin errores.
- [X] La migración está en el repo y `public.games` tiene la fila `caida` en el proyecto remoto; `get_advisors` no reporta avisos nuevos.
- [X] `/juego/caida` existe, `/biblioteca` lista dos juegos y el filtro PUZZLE muestra `CAÍDA`.
- [X] En `/juego/caida/jugar`: `←`/`→` mueven la pieza, `↑` y `X` la rotan, `↓` la baja una fila y `Espacio` la suelta de golpe.
- [X] Pulsar `P` o `Esc` **no** hace nada: la pausa solo responde al botón de la plataforma.
- [X] Completar una línea la borra, sube `LÍNEAS` y suma `100 × nivel`; cuatro líneas de golpe suman `800 × nivel`.
- [X] Cada 10 líneas sube el nivel y las piezas caen visiblemente más rápido.
- [X] Aparece la pieza tuerca (3×3 con un agujero) entre las 8 posibles.
- [X] El tablero se ve centrado en el marco CRT, con el HUD del juego y el panel SIGUIENTE a su derecha, sin recorte ni scroll horizontal en una ventana estrecha.
- [X] El HUD dibujado dentro del canvas muestra PUNTUACIÓN, LÍNEAS y NIVEL con el mismo contenido y orden que el sidebar del juego original, y coincide con el HUD React de la página.
- [X] El HUD de `caida` muestra PUNTUACIÓN, VIDAS (`♥`, una sola) , NIVEL y LÍNEAS.
- [X] El HUD de `rocas` sigue mostrando PUNTUACIÓN, VIDAS y NIVEL, y **no** LÍNEAS.
- [X] La fila de controles bajo el CRT es la del juego que se está jugando, y la de `caida` no menciona ninguna tecla de pausa.
- [X] `PAUSA` congela la caída pero el tablero sigue visible (no se queda en negro); `REANUDAR` no produce un salto de tiempo: la pieza no baja de golpe varias filas.
- [X] Pulsar flechas o espacio durante la partida no hace scroll de la página.
- [X] Que una pieza nueva no quepa al aparecer emite `onGameOver` y abre el modal `FIN DEL JUEGO` de la plataforma con la puntuación real; `GUARDAR PUNTUACIÓN` la escribe en `public.scores` con `game_id = 'caida'`.
- [X] El juego no dibuja ningún overlay propio de GAME OVER ni de PAUSA, y no escribe nada en `localStorage` (`grep` limpio de `localStorage` en `lib/games/caida.ts`).
- [X] El botón `FIN` acaba en el mismo modal, con la puntuación acumulada hasta ese momento.
- [X] Esa puntuación aparece entre las 10 de la barra lateral de `/juego/caida`, en el tab `CAÍDA` del Salón de la Fama y en el tab `GLOBAL`, sin haber tocado `layout.tsx` ni `salon-de-la-fama/client.tsx`.
- [X] Salir de la pantalla detiene el `requestAnimationFrame` y quita los listeners de `keydown`: volver a entrar no duplica el juego ni acelera la caída, y las teclas no siguen respondiendo fuera de la pantalla de juego.
- [X] `JUGAR DE NUEVO` empieza una partida nueva con el tablero vacío y 0 puntos.
- [X] `/juego/rocas/jugar` se juega exactamente igual que antes de este spec.
- [X] Un id que no está en `games` (por ejemplo `/juego/serpentina`) sigue devolviendo 404.

## Decisions taken and discarded

- **Portar `game.js` casi verbatim**, no reescribirlo en React: misma decisión y mismas razones que SPEC 05. El juego funciona; React solo monta el canvas y escucha el estado.
- **Se porta la pieza tuerca (la 8ª, no estándar)**: es lo que distingue a este juego del Tetris de siempre. Quitarla sería rediseñar el juego de origen antes de haberlo jugado, y eso no es un port.
- **El registry se crea ahora, no en SPEC 05**: hacía falta un segundo juego para saber qué comparten de verdad. La respuesta —`score` y `lives` obligatorios, `level`/`lines` opcionales— no se podía escribir con un solo juego sin inventarla.
- **`lives` es obligatorio y `caida` reporta `1`**, descartado hacerlo opcional: todos los juegos de la plataforma tienen vidas, y "una vida" es una respuesta válida a la pregunta, no una ausencia. El HUD pinta siempre la casilla y no necesita un caso especial.
- **El fin de partida es un evento (`onGameOver`), no un campo de estado**: descartado conservar `gameOver: boolean` en `GameState` junto al callback. Dos canales para el mismo hecho se contradicen en cuanto uno se emite y el otro no. Cuesta un cambio pequeño en Asteroids y elimina la duda de cuál manda.
- **La pausa la controla solo la plataforma**, por el prop `paused`: el botón ya existe y es genérico. Conservar además la tecla `P` del original obligaría a sincronizar dos fuentes de verdad para poder mostrar el rótulo correcto en el botón — más código para un empate.
- **En pausa se sigue dibujando**: `loop()` llama a `draw()` y salta `update()`. Congelar también el `draw()` dejaría el tablero en negro bajo el overlay de PAUSA, que no es lo que el jugador espera ver al reanudar.
- **`GameState` con campos opcionales nombrados**, descartado un `Record<string, number>` genérico: el HUD tiene que etiquetar cada número en español, y con nombres reales el compilador comprueba que el juego y la pantalla hablan de lo mismo.
- **El HUD del juego se conserva y se dibuja en el canvas**, aunque la plataforma ya muestre los mismos números arriba: es la misma decisión de HUD duplicado que tomó SPEC 05 con Asteroids, y es lo que pide el encargo. En el original ese HUD es un sidebar HTML; con un solo canvas, conservarlo "tal cual" significa redibujarlo con el mismo contenido y orden.
- **El leaderboard local del original se borra sin sustituto**: la plataforma ya tiene top 10 por juego en `public.scores`. Mantener los dos daría dos rankings que nunca coinciden, y el local no lo ve nadie más.
- **Un solo canvas de 800×600**, descartado el segundo `<canvas>` del original: dos elementos obligarían a que el registry tuviera dos firmas distintas y a tocar el JSX y el CSS del CRT. Con un canvas, el tablero se centra y el panel SIGUIENTE se dibuja a su derecha, que es la disposición pedida, y `.game-canvas` sirve sin cambios.
- **Se reutiliza `.cover-tetro`**, huérfana desde SPEC 06 y ya un motivo de tetriminó: escribir una clase nueva sería duplicar CSS que existe y encaja.
- **Id `caida`, no `tetris`**: es el id que SPEC 01 ya reservaba para este juego, está en español como el resto del catálogo, y evita el nombre registrado por The Tetris Company.
- **El tema claro/oscuro del original no se porta**: la plataforma tiene su propio CRT. Portarlo añadiría un `localStorage` y un botón que compiten con la estética del sitio.
- **El estado del HUD pasa a un único `useState<GameState>`**, descartado mantener un `useState` por campo: con campos que existen en unos juegos y no en otros, cuatro estados sueltos obligan a decidir qué valor "falso" tiene un campo que no aplica.

## Identified risks

| Riesgo                                                                                                                                                                                                                       | Mitigación                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El registry se generaliza y el port entran en el mismo spec: si algo se rompe, no está claro cuál fue.                                                                                                                       | Los pasos 2 y 3 dejan el sistema funcional con **solo** `rocas` sobre la estructura nueva. Si `rocas` se rompe ahí, es el registry; si se rompe en el paso 5, es el port.              |
| `game.js` usa variables de módulo (`board`, `current`, `score`…). Fuera de `startCaida`, dos montajes compartirían tablero.                                                                                                  | Todo el estado va dentro de la función. El criterio de "volver a entrar no duplica el juego" lo verifica, y StrictMode en desarrollo monta dos veces a propósito.                      |
| El original llama a `loop()` de forma reentrante al reanudar (`togglePause` invoca `loop` directamente). Portado tal cual dejaría dos `requestAnimationFrame` vivos y duplicaría la velocidad de caída.                      | `togglePause()` no se porta: la pausa entra por `setPaused()` y el loop nunca se reprograma a sí mismo dos veces. Lo verifica el criterio de "reanudar no produce un salto de tiempo". |
| Cambiar el contrato de fin de partida toca Asteroids, que hoy funciona: si `onGameOver` no se conecta bien, `rocas` deja de guardar puntuaciones y es una regresión silenciosa (la partida acaba, pero el modal no aparece). | El paso 2 migra Asteroids **antes** de escribir una sola línea de Tetris, y hay un criterio explícito de que `/juego/rocas/jugar` se juega y se guarda igual que antes.                |
| `onGameOver` emitido más de una vez (por ejemplo, `spawn()` colisiona y además se pulsa `FIN`) abriría el modal con puntuaciones distintas o permitiría guardar dos veces.                                                   | El juego emite el evento una sola vez por partida: una guarda interna lo marca y `endGame()` no hace nada si ya terminó.                                                               |
| TypeScript `strict` sobre matrices indexadas por número (`PIECES`, `COLORS`, `board`) puede exigir anotaciones o guardas.                                                                                                    | Es coste de tiempo, no de comportamiento, siempre que no se aproveche para "mejorar" la lógica de paso.                                                                                |

## Lo que **no** entra en este spec

- El tercer juego (`04-arkanoid`).
- Tema claro/oscuro, sonido, controles táctiles.
- _Hold_, bolsa de 7, _lock delay_, rotación SRS.
- Overlays, botones o leaderboard propios dentro del canvas: los pone la plataforma.
- La tecla `P`/`Esc` como pausa, y cualquier segunda fuente de verdad para el estado de pausa.
- Vidas múltiples en `caida`: tiene una, y perderla acaba la partida.
- Cualquier cambio al esquema de Supabase, al leaderboard o al Salón de la Fama.

Cada uno de ellos, si llega, va en su propio spec.
