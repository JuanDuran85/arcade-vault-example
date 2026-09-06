# SPEC 05 — Primer juego real: Asteroids en `/juego/rocas/jugar`

> **Status:** Implemented
> **Depends on:** SPEC 01
> **Date:** 2026-09-05
> **Objective:** Portar el juego de canvas ya existente en `references/started-games/02-asteroids/game.js` a un módulo del proyecto y montarlo en la pantalla de juego de `rocas`, sustituyendo ahí la simulación decorativa por partidas reales con puntuación guardable.

---

## Por qué existe este spec

`app/juego/[id]/jugar/client.tsx` finge jugar: un `setInterval` sube la puntuación y la "nave" y los "enemigos" son divs CSS estáticos. Mientras tanto, en `references/started-games/02-asteroids/` hay un Asteroids completo y funcional (nave, asteroides que se parten, partículas, vidas, niveles, power-up de disparo triple) escrito en canvas puro sin dependencias. Este spec conecta ambos: el juego se copia casi verbatim a `lib/games/asteroids.ts`, la pantalla de juego lo monta cuando el id es `rocas`, y la puntuación real alimenta el modal de fin de partida y `saveScore` que ya existen. Ningún otro juego del catálogo cambia.

## Scope

**In:**

- `lib/games/asteroids.ts` — el contenido de `references/started-games/02-asteroids/game.js` envuelto en `startAsteroids(canvas, callbacks)`, tipado para TypeScript `strict`, devolviendo una función de limpieza.
- `app/juego/[id]/jugar/client.tsx`: cuando `id === "rocas"` renderiza un `<canvas>` dentro del `.crt-screen` y arranca el juego; para cualquier otro id conserva la simulación decorativa actual sin tocarla.
- HUD duplicado a propósito: el juego sigue dibujando su `drawHUD()` en el canvas **y** el HUD React de la página se alimenta de los valores reales vía callback.
- Botones existentes conectados al juego real: `PAUSA` congela el loop, `FIN` fuerza el fin de partida con la puntuación real, `SALIR` desmonta y limpia.
- Fin de partida real (0 vidas o botón `FIN`) → modal `FIN DEL JUEGO` existente con la puntuación real y `saveScore` a `localStorage` (`av_scores`).
- Fila de controles (`← → ROTAR · ↑ PROPULSAR · ESPACIO DISPARAR`) bajo el marco CRT, solo para `rocas`.
- Escalado del canvas por CSS en `app/globals.css`: buffer interno fijo `800×600`, presentación `width: 100%` con `aspect-ratio: 4 / 3`.
- `preventDefault` en las teclas del juego (flechas y espacio) para que la página no haga scroll mientras se juega.
- Nota en `CLAUDE.md`: `rocas` ya es un juego real; el resto sigue siendo simulación.

**Out of scope (para specs futuros):**

- Los otros dos juegos de `references/started-games/` (`03-tetris`, `04-arkanoid`) y un registry `id → juego`. Se escribirá cuando exista el segundo juego real, no antes.
- Los otros 7 ids del catálogo (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`): siguen con la simulación decorativa.
- Persistir puntuaciones en Supabase o asociarlas al usuario autenticado de SPEC 04: `saveScore` sigue escribiendo en `localStorage` igual que hoy.
- Controles táctiles / móvil, mandos, o remapeo de teclas.
- Sonido.
- Cambiar la estética del juego (colores, vectores, fuente del canvas) para que combine con el CRT de la plataforma: se porta tal cual está.
- Sustituir `seededScores()` del leaderboard por puntuaciones reales.

## Data model

Ninguna estructura persistida nueva. El único contrato nuevo es la interfaz del módulo del juego:

```ts
// lib/games/asteroids.ts
export interface AsteroidsState {
  score: number;
  lives: number;
  level: number;
  gameOver: boolean;
}

export interface AsteroidsHandle {
  stop(): void; // cancela el rAF y quita los listeners de teclado
  setPaused(paused: boolean): void;
  endGame(): void; // fuerza state = 'gameover' conservando la puntuación
}

export function startAsteroids(
  canvas: HTMLCanvasElement,
  onState: (state: AsteroidsState) => void,
): AsteroidsHandle;
```

`onState` se invoca solo cuando alguno de los cuatro valores cambia respecto al frame anterior (no 60 veces por segundo), para no forzar un re-render de React en cada frame.

La puntuación guardada sigue siendo la `ScoreRow` existente de `lib/types.ts`, con `game: "rocas"` — sin cambios.

## Implementation plan

1. Crear `lib/games/asteroids.ts`: copiar `references/started-games/02-asteroids/game.js` verbatim y envolverlo en `startAsteroids`. Cambios mínimos y solo los necesarios:
   - `canvas`/`ctx` vienen del argumento en vez de `document.getElementById`.
   - Los listeners de `keydown`/`keyup` se registran en `window` al arrancar, llaman `e.preventDefault()` para `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown` y `Space`, y se eliminan en `stop()`.
   - El id del `requestAnimationFrame` se guarda para cancelarlo en `stop()`.
   - Tipos explícitos donde `strict` los exija (campos de clase, firmas de método); nada de reescribir la lógica.
   - `drawHUD()` se conserva intacto (HUD duplicado por decisión).
   - Al final de `update`, comparar `{score, lives, level, gameOver: state === 'gameover'}` con el último notificado y llamar `onState` solo si difiere.
   - `setPaused(true)` hace que `loop` salte `update(dt)` (sigue dibujando) y reinicia `lastTime` al reanudar para que `dt` no dé un salto.
   - `endGame()` pone `state = 'gameover'` y notifica.
2. En `app/juego/[id]/jugar/client.tsx`, extraer un componente `AsteroidsCanvas` (mismo archivo) con un `useRef<HTMLCanvasElement>` y un `useEffect` que llame `startAsteroids` al montar y `stop()` en la limpieza. El efecto depende solo del ref: **no** se reinicia el juego en cada render.
3. En el mismo `client.tsx`, calcular `const isAsteroids = id === "rocas";`. Si lo es: no arrancar el `setInterval` de puntuación falsa, renderizar `AsteroidsCanvas` en lugar de `.game-arena`, y alimentar `score`/`lives`/`level`/`over` desde el callback `onState`. Si no lo es, todo el comportamiento actual queda idéntico.
4. Conectar los botones para `rocas`: `PAUSA` llama `setPaused` en el handle además de alternar el overlay existente; `FIN` llama `endGame()`; `restart` (JUGAR DE NUEVO) desmonta y vuelve a montar el canvas mediante un `key` incremental. `SALIR` ya navega y el `useEffect` limpia solo.
5. Añadir a `app/globals.css` los estilos del canvas (`display:block; width:100%; height:auto; aspect-ratio:4/3; background:#000; image-rendering:pixelated`) y de la fila de controles bajo el CRT, reutilizando las clases/variables tipográficas ya presentes (`mono`, `--ink-dim`).
6. Renderizar la fila de controles bajo `.crt-bottom` solo cuando `isAsteroids`.
7. Documentar en `CLAUDE.md` (sección **Data & session**) que `rocas` ya no es simulación: el juego vive en `lib/games/asteroids.ts` y el resto de ids siguen decorativos.
8. Pasada manual: jugar `/juego/rocas/jugar` (rotar, propulsar, disparar, partir asteroides, recoger el power-up, morir 3 veces), comprobar el HUD React sincronizado con el del canvas, pausar/reanudar, pulsar FIN, guardar puntuación y verla en `/juego/rocas` y `/salon-de-la-fama`. Comprobar además que `/juego/caida/jugar` sigue con la simulación anterior. `npm run lint` y `npm run build` sin errores.

## Acceptance criteria

- [x] `npm run build` y `npm run lint` terminan sin errores.
- [x] En `/juego/rocas/jugar` se ve el juego real: la nave rota con `←`/`→`, propulsa con `↑` y dispara con `Espacio`.
- [x] Destruir un asteroide grande lo parte en medianos y estos en pequeños; la puntuación sube 20/50/100 según el tamaño.
- [x] El HUD React de la página muestra la misma puntuación, vidas y nivel que el HUD dibujado dentro del canvas.
- [x] Pulsar flechas o espacio durante la partida no hace scroll de la página.
- [x] `PAUSA` congela el juego y `REANUDAR` lo continúa sin salto de tiempo; `FIN` abre el modal con la puntuación real.
- [~] Perder las tres vidas abre el modal `FIN DEL JUEGO` con la puntuación real y `GUARDAR PUNTUACIÓN` la escribe en `av_scores`. **La parte de "aparecer en el leaderboard" no se cumple y no puede cumplirse en este spec**: contradice su propio scope, que deja `seededScores()` fuera. Ningún componente lee `av_scores` todavía (limitación preexistente). Se traslada al spec que lleve las puntuaciones a datos reales.
- [x] `JUGAR DE NUEVO` inicia una partida nueva desde 0 puntos y 3 vidas.
- [x] Salir de la pantalla (`SALIR` o navegar) detiene el `requestAnimationFrame` y quita los listeners de teclado: volver a entrar no duplica el juego ni acelera la nave.
- [x] El canvas se ve completo dentro del marco CRT en una ventana estrecha, sin scroll horizontal ni recorte.
- [x] La fila de controles aparece bajo el CRT solo en `rocas`.
- [x] `/juego/caida/jugar` (y cualquier otro id) sigue mostrando exactamente la simulación decorativa anterior.

## Decisions taken and discarded

- **Módulo `lib/games/asteroids.ts` con `game.js` casi verbatim**, en vez de reescribir el juego en hooks de React: el juego ya funciona y está probado; reescribirlo cambia mucho código para obtener el mismo comportamiento con más superficie de bugs. React solo monta el canvas y escucha el estado.
- **Descartado el iframe a `public/games/`**: sería cero cambios al juego, pero deja el HUD, la pausa y el guardado de puntuación aislados detrás de la frontera del iframe, que es justo lo que este spec quiere conectar.
- **Solo `rocas`, sin registry `id → juego`**: con un único juego real, un mapa de loaders es abstracción especulativa. El registry se escribe cuando exista el segundo juego y se sepa qué tienen realmente en común.
- **HUD duplicado (canvas + React) a propósito**: decisión explícita del usuario; borrar `drawHUD()` sería menos código pero cambia el aspecto del juego portado, y el doble HUD retro es el look buscado.
- **Escalado por CSS, no canvas responsive**: el buffer sigue en 800×600, así que `wrap()`, los radios y el spawn siguen siendo exactamente los del original. Un canvas verdaderamente responsive tocaría la física, no el estilo.
- **`onState` solo en cambio de valor**: notificar 60 veces por segundo provocaría un re-render de React por frame sin ningún cambio visible.
- **`preventDefault` en las teclas del juego**: en el HTML original el canvas ocupaba toda la ventana y no había nada que scrollear; aquí la página sí scrollea y las flechas la moverían mientras se juega.
- **Simulación decorativa intacta para los demás ids**: sustituirla por "próximamente" borraría una demo visual que ya existe y no aporta nada a este spec.
- **Puntuaciones siguen en `localStorage`**: llevarlas a Supabase es un cambio de datos, no de juego, y merece su propio spec (igual que se decidió en SPEC 04).

## Identified risks

- **Estado global del módulo**: `game.js` usa variables de módulo (`ship`, `asteroids`, `score`…). Si quedaran fuera de `startAsteroids`, dos montajes compartirían estado. Mitigado porque **todo** el estado vive dentro de la función; el criterio de "volver a entrar no duplica el juego" lo verifica.
- **StrictMode en desarrollo monta y desmonta dos veces**: si `stop()` no limpia bien el rAF o los listeners, la nave respondería doble a cada tecla. Es exactamente el síntoma que cubre el criterio anterior, y solo se detecta jugando.
- **TypeScript `strict` sobre código JS suelto**: las clases del original no declaran campos y los arrays `RADII`/`SPEEDS`/`POINTS` se indexan por número. Puede exigir anotaciones; el riesgo es tiempo, no comportamiento, siempre que no se aproveche para "mejorar" la lógica de paso.
