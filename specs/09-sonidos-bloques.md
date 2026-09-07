# SPEC 09 — Sonido en `bloques` (rebote y ruptura)

> **Status:** Implemented
> **Depends on:** SPEC 08
> **Date:** 2026-09-06
> **Objective:** Portar los dos MP3 del Arkanoid original a `public/sounds/` y hacer que `bloques` suene al romper un bloque y al rebotar contra las paredes izquierda, derecha, superior y contra la paleta, con un botón MUTE en la pantalla de juego que recuerda la preferencia.

---

## Por qué existe este spec

SPEC 08 dejó el sonido fuera **a propósito**, con dos consecuencias que este spec revierte de forma explícita:

- Su criterio «`grep` limpio de `localStorage`, `document.` y `new Audio` en `lib/games/bloques.ts`, y ningún archivo nuevo en `public/`» queda **superado** en su parte de `new Audio` y `public/`. Las otras dos prohibiciones (`localStorage`, `document.`) siguen en pie: el juego no persiste nada y no toca el DOM. **La preferencia de silencio la guarda la plataforma, no el juego.**
- Su decisión «No: `new Audio()` a nivel de módulo» **no** se revierte. El motivo sigue siendo válido: ese constructor se ejecutaría al importar el módulo, y `lib/games/bloques.ts` acaba en el grafo de un Server Component. Los dos `Audio` se crean **dentro de `start()`**, junto al resto del estado del closure.

No se toca `spritesheet-breakout.png`: los sprites siguen fuera. Este spec es solo audio.

`bloques` es el primer juego de la plataforma que emite sonido, así que introduce una capacidad nueva en el contrato (`setMuted`) y un botón nuevo en la barra de acciones. Ambos se diseñan para que `rocas` y `caida` no cambien ni una línea.

### Los cinco puntos que suenan

Coinciden 1:1 entre el original y el port, sin buscar nada:

| Evento                 | `references/started-games/04-arkanoid/game.js` | `lib/games/bloques.ts` |
| ---------------------- | ---------------------------------------------- | ---------------------- |
| Pared izquierda        | `:117`                                         | `:218-221`             |
| Pared derecha          | `:118`                                         | `:222-225`             |
| Pared superior (techo) | `:119`                                         | `:226-229`             |
| Paleta                 | `:131`                                         | `:232-241`             |
| Bloque destruido       | `:142`                                         | `:246-257`             |

El original no suena al perder la bola por abajo, ni al cambiar de nivel, ni al acabar la partida. Este spec tampoco.

## Scope

**In:**

- `public/sounds/ball-bounce.mp3` y `public/sounds/break-sound.mp3`, copiados byte a byte de `references/started-games/04-arkanoid/assets/sounds/`. 19 KB en total.
- `lib/games/bloques.ts` — dos `new Audio()` **dentro de `start()`**, una función local `play(sound)` y sus cinco llamadas en los puntos de la tabla de arriba. `stop()` deja de sonar.
- `GameHandle.setMuted?(muted: boolean): void` en `lib/games/registry.ts` — **opcional**, para que `asteroids.ts` y `caida.ts` no cambien.
- `GameEntry.sound?: boolean` en `lib/games/registry.ts` — solo `bloques` lo pone a `true`; es lo que decide si se pinta el botón MUTE.
- `app/juego/[id]/jugar/client.tsx` — estado `muted`, botón MUTE/SONIDO en `hud-actions` renderizado solo si `entry.sound`, efecto que lo propaga con `handleRef.current?.setMuted(muted)` (mismo patrón que `paused`), y lectura/escritura de `localStorage["av_muted"]`.
- Nota en la sección **Data & session** de `CLAUDE.md`.

**Out of scope (para specs futuros):**

- Sonido en `rocas` y `caida`. Cuando alguno lo quiera, ese spec decidirá si extraer un `lib/games/audio.ts` compartido. Hoy hay un solo cliente y no se inventa una capa para él.
- Música de fondo, sonido de menú, de fin de partida, de pérdida de vida o de cambio de nivel. El original no los tiene.
- Control de volumen (slider). El botón es binario.
- El spritesheet `spritesheet-breakout.png` y `assets/spritesheet.js`, que siguen fuera desde SPEC 08.
- Web Audio API, precarga con `<link rel="preload">`, sprites de audio o cualquier optimización: son dos MP3 de 10 KB y 8 KB.
- Cambios en `lib/catalog.ts`, `lib/scores.ts`, el esquema de Supabase o cualquier migración. Este spec no toca datos.

## Data model

Ninguna estructura persistida en Supabase. Dos cosas nuevas, ambas pequeñas:

**1. Clave de `localStorage`** (la escribe la plataforma, nunca el juego):

```ts
localStorage["av_muted"]; // "1" = silenciado. Ausente o cualquier otro valor = con sonido.
```

Sigue el prefijo `av_` de `av_player_name`. Ausencia = con sonido, así que la primera visita suena, que es el motivo de este spec.

**2. Dos campos nuevos en `registry.ts`**, los dos opcionales:

```ts
export interface GameHandle {
  stop(): void;
  setPaused(paused: boolean): void;
  endGame(): void;
  setMuted?(muted: boolean): void; // solo los juegos con sonido
}

interface GameEntry {
  start(canvas: HTMLCanvasElement, callbacks: GameCallbacks): GameHandle;
  controls: string;
  sound?: boolean; // pinta el botón MUTE; hoy solo bloques
}
```

`GameState` y `GameCallbacks` **no cambian**: el sonido no es estado que React necesite ver.

Estado nuevo dentro del closure de `startBloques`:

```ts
const bounceSound = new Audio("/sounds/ball-bounce.mp3");
const breakSound = new Audio("/sounds/break-sound.mp3");
let muted = false;
```

### Por qué dos campos y no uno

`sound` es estático y se lee en el render (`entry.sound`), antes de que exista ningún handle. `setMuted` es dinámico y vive en el handle, que no existe hasta que el canvas monta. Deducir uno del otro obligaría a renderizar el botón mirando una `ref`, que es justo lo que React no garantiza que esté sincronizado en el render.

### Reproducción

Verbatim del original: `sound.cloneNode().play()`. Cada golpe reproduce su propio elemento, así que dos rupturas seguidas se solapan en vez de cortarse. El elemento clonado lo recoge el GC cuando termina.

```ts
function play(sound: HTMLAudioElement) {
  if (muted) return;
  (sound.cloneNode() as HTMLAudioElement).play().catch(() => {});
}
```

El `.catch(() => {})` no es decorativo: `play()` devuelve una promesa que **rechaza** si el navegador bloquea la reproducción por la política de autoplay. Sin él, cada rebote antes de la primera interacción del usuario imprime un `Unhandled Promise Rejection` en consola. El juego no se entera y sigue: el sonido es adorno, no mecánica.

### El silencio y la pausa

No hace falta ninguna guarda nueva. Las cinco llamadas a `play()` viven **dentro de `update()`**, que ya no se llama en pausa ni tras el fin de partida (SPEC 07 y SPEC 08). El `mousemove` no suena, así que la guarda `if (paused || finished) return` de SPEC 08 no necesita tocarse.

`stop()` no tiene que parar nada explícitamente: los clones que estuvieran sonando duran menos de un segundo y no quedan referenciados. Lo que sí hace `stop()` es lo de siempre — cancelar el `rAF` y quitar los tres listeners — y sin `update()` no nacen clones nuevos.

## Implementation plan

1. Copiar los dos MP3 a `public/sounds/`. Verificar que `/sounds/ball-bounce.mp3` y `/sounds/break-sound.mp3` se sirven con 200 desde el dev server. Nada de código todavía.
2. Añadir `setMuted?` a `GameHandle` y `sound?` a `GameEntry` en `lib/games/registry.ts`, y `sound: true` a la entrada de `bloques`. Al ser ambos opcionales, `asteroids.ts` y `caida.ts` compilan sin cambios. `npm run build` pasa.
3. En `lib/games/bloques.ts`: declarar los dos `Audio` y `muted` dentro de `start()`, la función `play()` de arriba, y devolver `setMuted` en el handle. Todavía sin llamadas a `play()`: el juego suena exactamente igual que antes (nada).
4. Insertar las cinco llamadas en los puntos de la tabla: `play(bounceSound)` en los tres rebotes de pared y en el de la paleta, `play(breakSound)` justo tras `block.alive = false`. Comprobación manual: los cinco eventos suenan y ninguno suena de más.
5. En `app/juego/[id]/jugar/client.tsx`: estado `muted` (inicial `false`), efecto de montaje que lo lee de `localStorage["av_muted"]`, efecto que llama a `handleRef.current?.setMuted(muted)` — en su **propio** `useEffect` dentro de `GameCanvas`, junto al de `paused`, y con un `muted` nuevo en los props—, y el toggle que escribe la clave al pulsar.
6. Renderizar el botón en `hud-actions` solo si `entry.sound`, entre `PAUSA` y `FIN`: `{muted ? "SONIDO" : "SILENCIO"}`, con `aria-pressed={muted}`.
7. Actualizar la sección **Data & session** de `CLAUDE.md`: `bloques` es el primer juego con audio, los MP3 viven en `public/sounds/`, el `Audio` se construye dentro de `start()` y nunca a nivel de módulo, y la preferencia de silencio la guarda la plataforma en `av_muted` porque los juegos no tocan `localStorage`.
8. Pasada manual (ver criterios de aceptación).

## Acceptance criteria

- [x] Romper un bloque suena, y suena **una vez por bloque**, no una por frame de la explosión.
- [x] La bola suena al rebotar contra la pared izquierda, contra la derecha y contra el techo.
- [x] La bola suena al rebotar contra la paleta.
- [x] Perder la bola por abajo **no** suena. Cambiar de nivel **no** suena. Acabar la partida **no** suena.
- [x] Dos bloques rotos casi a la vez se solapan en el audio, no se cortan entre sí.
- [x] El botón de sonido aparece en `/juego/bloques/jugar` y **no** aparece en `/juego/rocas/jugar` ni en `/juego/caida/jugar`.
- [x] Pulsarlo silencia el juego al instante: ningún rebote ni ruptura suena mientras esté activo.
- [x] Silenciar, salir y volver a entrar mantiene el silencio. Quitar el silencio y volver a entrar mantiene el sonido.
- [x] La primera visita, sin `av_muted` en `localStorage`, suena.
- [x] `JUGAR DE NUEVO` conserva la preferencia de silencio; no la resetea.
- [x] En pausa no suena nada aunque la bola estuviera a punto de golpear. Tras el fin de partida tampoco.
- [x] Salir de la pantalla de juego corta el sonido: no llega ningún rebote desde otra ruta.
- [x] La consola del navegador no muestra ningún error ni `Unhandled Promise Rejection` relacionado con `play()`, ni siquiera antes de la primera interacción.
- [x] `grep` limpio de `localStorage` y `document.` en `lib/games/bloques.ts` (el `new Audio` ahora sí aparece, y solo dentro de `start()`; a nivel de módulo, cero).
- [x] `public/sounds/` contiene exactamente dos archivos y no se ha añadido ningún PNG.
- [x] `/juego/rocas/jugar` y `/juego/caida/jugar` se juegan y se ven exactamente igual que antes de este spec, sin un solo cambio en `asteroids.ts` ni en `caida.ts`.
- [x] Todos los criterios de aceptación de SPEC 08 siguen pasando, salvo la parte de su último `grep` que este spec supera de forma explícita.
- [x] `npm run lint` y `npm run build` terminan sin errores.

## Decisions taken and discarded

- **Sí: copiar los dos MP3 tal cual a `public/`.** Son los sonidos característicos del original, que es literalmente lo que se pide, y pesan 19 KB. Descartado sintetizarlos con `OscillatorNode`: más código, y no serían estos sonidos.
- **No: `new Audio()` a nivel de módulo.** Se mantiene la decisión de SPEC 08 sin discutirla: el constructor se ejecutaría al importar, y este módulo acaba en el grafo de un Server Component. Van dentro de `start()`, con el resto del estado del closure.
- **Sí: `cloneNode().play()` como el original.** Dos golpes seguidos se solapan. Descartado un solo `Audio` con `currentTime = 0`: menos basura para el GC, pero se corta a sí mismo justo cuando el juego se pone interesante.
- **Sí: botón MUTE con la preferencia recordada.** Audio sin forma de apagarlo es hostil. Descartado no persistirlo: obligaría a silenciar en cada partida.
- **Sí: la preferencia la guarda la plataforma, no el juego.** La regla de SPEC 05 «el juego no escribe en `localStorage`» sigue viva; el juego solo recibe `setMuted(boolean)`. Además así la clave `av_muted` es única y no una por juego.
- **Sí: dos campos opcionales en `registry.ts` en vez de uno.** `sound` es estático y se necesita en el render; `setMuted` es dinámico y vive en el handle. Ver **Data model**. Descartado hacer `setMuted` obligatorio: obligaría a `asteroids.ts` y `caida.ts` a implementar un método vacío para nada.
- **No: un `lib/games/audio.ts` compartido.** Una abstracción con una sola implementación. Si `rocas` o `caida` piden sonido, ese spec la extrae con dos clientes reales delante.
- **Sí: `.catch(() => {})` en `play()`.** No es tragarse un error a la ligera: es la política de autoplay del navegador, es esperable, y el sonido es adorno. Sin él, la consola se llena antes del primer clic.
- **No: sonido para perder vida, subir de nivel o acabar la partida.** El original no los tiene y nadie los ha pedido.
- **No: control de volumen.** Un slider para dos efectos de sonido.
- **No: precarga explícita.** 18 KB entre los dos; el navegador los tiene antes del primer rebote.

## Identified risks

| Riesgo                                                                                                                    | Mitigación                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La política de autoplay bloquea los primeros sonidos si el jugador llega sin haber interactuado y la consola se llena.    | `.catch(() => {})` en `play()`, con su propio criterio de aceptación sobre la consola. El juego no depende del audio para nada.                                   |
| `muted` arranca en `false` y el efecto lee `localStorage` después: la etiqueta del botón puede parpadear un frame.        | Es un frame y solo afecta al texto del botón; leerlo en el render rompería la hidratación (SSR no tiene `localStorage`). Mismo patrón que `recallName`.           |
| El primer rebote ocurre antes de que el efecto de `setMuted` haya corrido, y suena una vez pese a estar silenciado.       | El efecto corre en el mismo flush que el de `paused`, antes del primer `requestAnimationFrame`. Criterio de aceptación: silenciar, salir y volver no suena nunca. |
| `setMuted` opcional se olvida de implementar en un juego futuro con `sound: true` y el botón queda decorativo sin avisar. | Hoy solo hay un juego con sonido. El `?.` no rompe nada, y el criterio «pulsarlo silencia al instante» lo detecta en la pasada manual.                            |
| El sonido de ruptura se dispara una vez por frame mientras dura la explosión.                                             | La llamada va donde `block.alive = false`, dentro del `if (collideAABB)`, que solo pasa una vez por bloque. Criterio de aceptación propio.                        |
| Alguien lee el criterio de SPEC 08 que prohíbe `new Audio` y `public/` y cree que este spec lo incumple.                  | Declarado explícitamente como superado en **Por qué existe este spec** y en los criterios de aceptación.                                                          |

## Qué **no** entra en este spec

- Sonido en `rocas` y `caida`, y cualquier helper de audio compartido.
- El spritesheet del original (sigue fuera desde SPEC 08).
- Música, más efectos, control de volumen.
- Web Audio API y cualquier optimización de carga.

Cada uno, si llega, va en su propio spec.
