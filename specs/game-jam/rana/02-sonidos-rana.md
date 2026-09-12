# SPEC 02 (game-jam/rana) — Sonido en `rana` (sin assets, sintetizado)

> **Status:** Draft
> **Depends on:** SPEC 06, SPEC 07, 01-rana-game
> **Date:** 2026-09-11
> **Objective:** Añadir sonido a `rana` reusando los campos `GameEntry.sound?`/`GameHandle.setMuted?` que SPEC 09 ya agregó a `registry.ts`, sintetizando los cinco efectos con Web Audio API porque, a diferencia de `bloques`, no existe ningún asset de audio original que portar.

---

## Por qué existe este spec

SPEC 01 dejó el sonido fuera a propósito, con su criterio «`grep` limpio de `new Audio`, `AudioContext`, `localStorage` y `document.` en `lib/games/rana.ts`». Este spec supera la parte de `AudioContext` (ahora sí aparece, dentro de `start()`); las otras tres prohibiciones siguen en pie sin cambios: `rana` sigue sin usar elementos `<audio>`, sin tocar el DOM y sin escribir en `localStorage` — la preferencia de silencio la sigue guardando la plataforma.

La diferencia con SPEC 09 (sonido de `bloques`) es de origen: `bloques` portó dos MP3 reales del Arkanoid original que estaban en `references/started-games/04-arkanoid/assets/sounds/`. `rana` se diseñó desde cero, como `snake`; no hay ningún `game.js` de Frogger en `references/` y, por lo tanto, tampoco ningún asset de audio que copiar. Descargar o fabricar archivos de audio de un Frogger real además arrastraría el mismo problema de marca que ya evitó el nombre del juego. La solución más simple es sintetizar los cinco efectos con osciladores de Web Audio API — una API nativa del navegador, sin dependencias nuevas y sin un solo archivo en `public/`.

El contrato ya tiene todo lo necesario desde SPEC 09: `GameHandle.setMuted?(muted: boolean): void` y `GameEntry.sound?: boolean` existen en `lib/games/registry.ts` sin que este spec los toque. `app/juego/[id]/jugar/client.tsx` ya renderiza el botón SILENCIO/SONIDO de forma genérica cuando `entry.sound` es verdadero, y ya propaga `setMuted` a través de `handleRef` en su propio efecto — confirmado leyendo el archivo, cero cambios ahí. Esto hace que este spec sea, en superficie de cambio, más pequeño que el propio SPEC 09: aquel tuvo que crear la capacidad; este solo la consume.

La preferencia de silencio sigue viviendo en la misma clave global `localStorage["av_muted"]` que ya usa `bloques` (SPEC 09: «así la clave es única y no una por juego»). Consecuencia directa: silenciar el sonido en `rana` también lo silencia en `bloques`, y viceversa — es una preferencia de plataforma, no de juego.

### Lo que funciona solo, sin escribir código

- El botón SILENCIO/SONIDO en `hud-actions`: ya es condicional a `entry.sound` desde SPEC 09, no se toca `client.tsx`.
- La propagación de `setMuted` desde React al `GameHandle`: ya existe su propio `useEffect` en `GameCanvas` desde SPEC 09.
- La lectura/escritura de `localStorage["av_muted"]`: genérica desde SPEC 09, no distingue por juego.
- El resto del leaderboard, el modal de fin de partida y el Salón de la Fama: sin cambios, como en cualquier spec de esta tanda.

## Scope

**In:**

- `lib/games/rana.ts`: un `AudioContext` creado de forma perezosa **dentro de `start()`** (nunca a nivel de módulo), una función local `beep(freq, durationMs, type, glideToFreq?)` con envolvente de ganancia (ataque/decay cortos para evitar clics) y cinco puntos de sonido:
  1. Salto válido de la rana.
  2. Pérdida de vida por atropello (coche).
  3. Pérdida de vida por ahogo (río sin tronco, o tronco que la saca del canvas).
  4. Nenúfar alcanzado.
  5. Nivel completado (los 5 nenúfares llenos).
- `sound: true` en la entrada `rana` de `lib/games/registry.ts` — la única línea que toca ese archivo; sus tipos no cambian, ya existen desde SPEC 09.
- `setMuted(muted)` en el `GameHandle` que devuelve `startRana`, que solo actualiza la variable `muted` del closure.
- Nota en la sección **Data & session** de `CLAUDE.md`.

**Out of scope (para specs futuros):**

- Música de fondo. El original no la tiene y nadie la pidió.
- Sonido de aviso cuando una tortuga empieza a hundirse: esa mecánica no existe hasta `03-dificultad-carriles.md`; si ese spec la quiere, la agrega él.
- Control de volumen (slider). El botón es binario, igual que `bloques`.
- Cualquier archivo `.mp3`/`.wav` en `public/`: no hay original que portar, así que no se agrega ninguno.
- Cambios a `app/juego/[id]/jugar/client.tsx`, a los tipos de `registry.ts` o a la clave `localStorage["av_muted"]`: todo ya es genérico desde SPEC 09.

## Data model

Ninguna estructura persistida nueva. Reutiliza la clave de `localStorage` que ya existe:

```ts
localStorage["av_muted"]; // misma clave global que usa bloques desde SPEC 09
```

Estado nuevo dentro del closure de `startRana`:

```ts
let audioCtx: AudioContext | null = null; // se crea en el primer beep, dentro de start()
let muted = false;

function beep(
  freq: number,
  durationMs: number,
  type: OscillatorType,
  glideToFreq?: number,
) {
  if (muted) return;
  audioCtx ??= new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  if (glideToFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(
      glideToFreq,
      audioCtx.currentTime + durationMs / 1000,
    );
  }
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    audioCtx.currentTime + durationMs / 1000,
  );
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + durationMs / 1000);
}
```

`GameState` y `GameCallbacks` no cambian: el sonido no es estado que React necesite ver. En `registry.ts` solo cambia un valor, no un tipo:

```ts
rana: {
  start: startRana,
  controls: "↑ ↓ ← → SALTAR · WASD TAMBIÉN",
  sound: true, // el único campo nuevo; setMuted? y sound? ya existían desde SPEC 09
},
```

## Implementation plan

1. En `lib/games/rana.ts`, declarar `let audioCtx: AudioContext | null = null;` y `let muted = false;` dentro de `start()`, y escribir `beep()` tal como en **Data model**. `npm run build` pasa; el juego suena exactamente igual que antes (nada).
2. Insertar las cinco llamadas en los puntos exactos de SPEC 01: `beep(600, 60, "square")` en cada salto válido de la rana (justo donde se acepta el movimiento, tras el chequeo de cooldown); `beep(220, 150, "sawtooth", 80)` al perder una vida por atropello; `beep(400, 200, "triangle", 100)` al perder una vida por ahogo; dos `beep` ascendentes (`523`, luego `659`, `80` ms cada uno, `"sine"`) al ocupar un nenúfar; un arpegio de cuatro `beep` ascendentes (`523`, `659`, `784`, `1047`, `70` ms cada uno) al completar el nivel.
3. Confirmar que el primer `beep()` (el del primer salto) resuelve la política de autoplay: `audioCtx.resume()` ya está dentro de `beep()`, así que no hace falta ningún gesto adicional — la propia tecla de salto es el gesto del usuario.
4. Devolver `setMuted(m) { muted = m; }` en el `GameHandle` de `startRana`. Añadir `audioCtx?.close()` dentro de `stop()` para no dejar contextos de audio abiertos entre partidas.
5. En `lib/games/registry.ts`, añadir `sound: true` a la entrada `rana` (una línea).
6. Actualizar la sección **Data & session** de `CLAUDE.md`: `rana` es el segundo juego con sonido y el primero que lo sintetiza con Web Audio API en vez de portar un asset, porque no existe ningún original que portar; reusa la misma clave global `av_muted` de SPEC 09.
7. Pasada manual (ver criterios de aceptación).

## Acceptance criteria

- [ ] Cada salto válido de la rana suena un beep corto y agudo.
- [ ] Perder una vida por atropello suena distinto (más grave y descendente) que perder una vida por ahogo.
- [ ] Ocupar un nenúfar suena una melodía corta ascendente de dos notas, distinta del beep de salto.
- [ ] Completar un nivel (llenar los 5 nenúfares) suena un arpegio de cuatro notas, distinto de los cuatro sonidos anteriores.
- [ ] El botón SILENCIO aparece en `/juego/rana/jugar` y sigue sin aparecer en `/juego/rocas/jugar` ni en `/juego/caida/jugar`.
- [ ] Pulsar SILENCIO corta los cinco sonidos al instante; volver a pulsarlo los recupera de inmediato.
- [ ] La preferencia de silencio es compartida con `bloques`: silenciar en `/juego/rana/jugar`, entrar a `/juego/bloques/jugar`, sigue silenciado (y viceversa).
- [ ] La primera visita, sin `av_muted` en `localStorage`, suena.
- [ ] La consola del navegador no muestra ningún error ni advertencia de autoplay/`AudioContext` al abrir la partida sin interacción previa.
- [ ] En pausa no suena nada nuevo, aunque un coche estuviera a punto de "atropellar" a la rana. Tras el fin de partida tampoco.
- [ ] Salir de la pantalla de juego no deja ningún sonido reproduciéndose ni contextos de audio abiertos (`stop()` cierra el `AudioContext`).
- [ ] `JUGAR DE NUEVO` conserva la preferencia de silencio; no la resetea.
- [ ] `grep` limpio de `new Audio`, `localStorage` y `document.` en `lib/games/rana.ts` (el `AudioContext` ahora sí aparece, y solo dentro de `start()`, nunca a nivel de módulo).
- [ ] `public/` no gana ningún archivo nuevo.
- [ ] `/juego/rana/jugar` se juega exactamente igual que en SPEC 01, salvo por el sonido.
- [ ] Todos los criterios de aceptación de SPEC 01 siguen pasando, salvo la parte de su `grep` sobre `AudioContext`, que este spec supera de forma explícita.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisions taken and discarded

- **Sí: sintetizar con Web Audio API en vez de portar MP3s.** No existe ningún asset original de Frogger en `references/`, a diferencia de `bloques`. Descartado buscar o fabricar archivos de audio: cero dependencias nuevas, cero assets nuevos en `public/`, y sin ninguna duda de licencia sobre efectos de un juego registrado.
- **Sí: reusar la clave global `av_muted`.** Ya la creó SPEC 09 y ya la lee/escribe `client.tsx` de forma genérica; una clave por juego fragmentaría la preferencia del jugador sin ningún beneficio real.
- **Sí: `AudioContext` perezoso, creado en el primer `beep()`, dentro de `start()`.** Mismo motivo que los `new Audio()` de SPEC 09: el constructor no existe en el servidor, y crearlo a nivel de módulo metería `rana.ts` en el grafo de un Server Component.
- **Sí: `resume()` dentro de `beep()` en vez de un efecto aparte.** Cualquier primer sonido (el del primer salto) ya cuenta como gesto del usuario; no hace falta un manejador dedicado.
- **No: sonido de aviso al hundirse una tortuga.** Esa mecánica no existe todavía; es decisión de `03-dificultad-carriles.md` si la agrega, para no mezclar el scope de un spec de sonido con uno de dificultad.
- **No: control de volumen.** Un botón binario alcanza, igual que en `bloques`.
- **No: tocar `registry.ts` más allá de una línea (`sound: true`).** Los campos `sound?`/`setMuted?` ya existen desde SPEC 09.
- **No: un `lib/games/audio.ts` compartido.** `bloques` ya decidió en SPEC 09 no extraer una capa de audio con un solo cliente real; con `rana` hay dos, pero además cada uno sintetiza de forma distinta (uno reproduce archivos, el otro genera osciladores), así que compartir código ahorraría poco y acoplaría dos formas distintas de sonar.

## Identified risks

| Riesgo                                                                                                                                          | Mitigación                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La política de autoplay del navegador bloquea el primer sonido si el navegador no reconoce la tecla como gesto válido.                          | `audioCtx.resume().catch(() => {})` dentro de `beep()`; el sonido es adorno, el juego sigue funcionando igual sin él. Criterio de aceptación propio sobre la consola. |
| Los cinco efectos sintetizados suenan "planos" comparados con una muestra de audio real.                                                        | Aceptado a propósito: no hay asset original que portar, y se prioriza cero archivos nuevos y cero riesgo de marca sobre la fidelidad tímbrica.                        |
| Un `AudioContext` por partida que no se cierra podría acumularse si el jugador entra y sale muchas veces sin recargar.                          | `stop()` llama a `audioCtx?.close()`; sin partida activa no queda ningún contexto abierto.                                                                            |
| Reusar `av_muted` global puede sorprender a quien no sabe que ya silenció `bloques`.                                                            | Comportamiento intencional, documentado en SPEC 09 y repetido aquí: es una preferencia de plataforma, no por juego.                                                   |
| Los `beep` de eventos que ocurren muy seguidos (dos atropellos casi simultáneos, poco probable con 3 vidas) podrían solaparse de forma extraña. | Cada `beep()` crea su propio `OscillatorNode`, así que dos llamadas se solapan igual que los sonidos clonados de `bloques`, sin cortarse entre sí.                    |

## Qué **no** entra en este spec

- Música de fondo.
- Sonido de aviso al hundirse una tortuga.
- Control de volumen.
- Cualquier asset de audio (`.mp3`/`.wav`) en `public/`.

Cada uno, si llega, va en su propio spec.
