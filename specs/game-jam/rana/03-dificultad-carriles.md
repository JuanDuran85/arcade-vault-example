# SPEC 03 (game-jam/rana) — Dificultad de carriles: tortugas que se hunden y velocidad sin techo

> **Status:** Draft
> **Depends on:** SPEC 06, SPEC 07, 02-sonidos-rana
> **Date:** 2026-09-11
> **Objective:** Dar variedad a los carriles del río de `rana` con tortugas que se hunden periódicamente y quitar el techo de `2.5×` al multiplicador de velocidad de nivel, para que la dificultad siga escalando de verdad en partidas largas.

---

## Por qué existe este spec

SPEC 01 dejó los 5 carriles del río como troncos homogéneos — todo lo que flota sostiene a la rana igual, sin sorpresas — e impuso un techo de `2.5×` al multiplicador de velocidad «para que niveles muy altos sigan siendo jugables». Ambas decisiones eran razonables para un primer spec, pero tienen un costo: a partir de cierto nivel, el juego deja de subir en desafío real (todo se mueve igual de rápido) y el río nunca exige nada distinto de reflejos. En una plataforma que compite por la puntuación más alta del Salón de la Fama, un techo de dificultad fijo es justo lo que sobra.

Este spec resuelve las dos cosas con un solo cambio conceptual — más variedad de carril, sin límite de escalada —, sin tocar nada de la mecánica base ni del sonido:

- Dos de los cinco carriles de río (filas 3 y 5) cambian de troncos a **grupos de tortugas** que ciclan entre a flote, a punto de hundirse y hundidas. Una tortuga hundida no sostiene a la rana — se ahoga igual que si no hubiera nada —, así que estos dos carriles exigen anticipar el ciclo, no solo esquivar.
- El multiplicador de velocidad por nivel deja de tener techo: sigue la misma fórmula de SPEC 01 (`1 + (level - 1) * 0.15`) pero sin el `Math.min(2.5, ...)`.

**Supera explícitamente** el criterio de aceptación de SPEC 01 «Llenar los 5 nenúfares ... el multiplicador nunca supera `2.5×`». A partir de este spec, ese techo desaparece; el resto de esa mecánica (fórmula, momento en que sube, reinicio de nenúfares) no cambia.

### Lo que funciona solo, sin escribir código

Nada nuevo respecto a SPEC 01 y SPEC 02: el leaderboard, el modal de fin de partida, el Salón de la Fama y el HUD React siguen siendo genéricos por `game_id` desde SPEC 06 y no necesitan ningún cambio para que una dificultad mayor se refleje en ellos — una puntuación más alta simplemente aparece donde ya aparecían las demás.

## Scope

**In:**

- `lib/games/rana.ts`: los carriles de río en las filas 3 y 5 pasan de `kind: "log"` a `kind: "turtle"`. Las filas 1, 2 y 4 siguen siendo troncos, sin cambios.
- Cada obstáculo de un carril `"turtle"` cicla por su cuenta entre tres fases: `up` (a flote, `3000 ms`), `warning` (a punto de hundirse, sigue sosteniendo, `800 ms`) y `down` (hundida, no sostiene, `1500 ms`), y vuelve a `up`. La fase inicial de cada grupo se sortea al azar dentro del ciclo para que no se hundan todas a la vez.
- Colisión de río actualizada: una tortuga en `down` no sostiene a la rana (se ahoga, mismo camino de SPEC 01 que "río sin tronco debajo"); en `up` o `warning` sostiene y arrastra igual que un tronco.
- Render: color distinto por fase (a flote, aviso, hundida) para que el jugador pueda anticipar el ciclo con solo mirar.
- El multiplicador de velocidad de nivel pierde su techo: se quita el `Math.min(2.5, ...)` de la fórmula de SPEC 01.
- Nota en la sección **Data & session** de `CLAUDE.md`.

**Out of scope (para specs futuros):**

- Sonido de aviso cuando una tortuga empieza a hundirse: al morir sobre una tortuga hundida ya suena el "ahogo" que agregó `02-sonidos-rana.md`; un sonido nuevo por evento mezclaría el scope de sonido con el de dificultad. Si se quiere, va en su propio spec.
- Cocodrilos, power-ups u otro tipo de obstáculo de meta: no son "carriles", son un tipo de peligro nuevo en la fila de meta.
- Carriles adicionales, mapas alternativos o un segundo tablero.
- Dificultad configurable por el jugador (elegir cuántas tortugas o qué tan rápido se hunden).
- Controles táctiles, modo dos jugadores.

## Data model

Ninguna estructura persistida nueva. Extiende el estado interno de `startRana` (SPEC 01) sin reemplazarlo:

```ts
type RiverObstacleKind = "log" | "turtle";

const TURTLE_UP_MS = 3000;
const TURTLE_WARNING_MS = 800;
const TURTLE_DOWN_MS = 1500;
const TURTLE_CYCLE_MS = TURTLE_UP_MS + TURTLE_WARNING_MS + TURTLE_DOWN_MS;

const TURTLE_ROWS = [3, 5]; // de los 5 RIVER_ROWS de SPEC 01; el resto sigue con troncos

interface RiverObstacle {
  x: number;
  phase: "up" | "warning" | "down"; // solo aplica si el carril es "turtle"
  elapsed: number; // ms transcurridos en el ciclo, se reinicia cada TURTLE_CYCLE_MS
}

interface RiverLane extends Lane {
  kind: RiverObstacleKind;
  obstacles: RiverObstacle[]; // reemplaza el `{ x: number }[]` genérico de SPEC 01 solo para río
}
```

`speedMultiplier` conserva su fórmula de SPEC 01, sin el techo:

```ts
// SPEC 01: speedMultiplier = Math.min(2.5, 1 + (level - 1) * 0.15);
speedMultiplier = 1 + (level - 1) * 0.15; // sin techo desde este spec
```

`GameState`, `GameCallbacks` y `GameHandle` de `registry.ts` no cambian: sigue reportando `score`, `lives`, `level`.

## Implementation plan

1. Extender el modelo de carril de río de SPEC 01: agregar `kind: "log" | "turtle"` a la configuración de cada `RiverLane`; las filas 1, 2 y 4 quedan `"log"` (comportamiento sin cambios), las filas 3 y 5 pasan a `"turtle"`. `npm run build` pasa; visualmente el juego se ve igual salvo el color de esas dos filas.
2. Al generar los obstáculos de un carril `"turtle"`, asignar a cada uno un `elapsed` inicial aleatorio entre `0` y `TURTLE_CYCLE_MS` (en vez de `0` fijo), para desincronizar el hundimiento entre grupos del mismo carril.
3. En cada frame, avanzar `elapsed += dt * 1000` de cada obstáculo `"turtle"` y derivar su `phase` según en qué tramo del ciclo cae (`up` si `elapsed < TURTLE_UP_MS`, `warning` si `elapsed < TURTLE_UP_MS + TURTLE_WARNING_MS`, si no `down`); al superar `TURTLE_CYCLE_MS`, `elapsed -= TURTLE_CYCLE_MS`. Dibujar cada tortuga con un color según su fase (a flote, aviso, hundida).
4. Ajustar el chequeo de soporte del río de SPEC 01: para un carril `"log"`, el chequeo no cambia; para un carril `"turtle"`, la rana solo está soportada si el obstáculo que la solapa tiene `phase !== "down"`. El resto de la lógica (arrastre horizontal, pérdida de vida si sale del canvas, ahogo si no hay soporte) es la misma de SPEC 01.
5. Quitar el `Math.min(2.5, ...)` de la fórmula de `speedMultiplier` en el punto donde SPEC 01 sube de nivel.
6. Actualizar la sección **Data & session** de `CLAUDE.md`: `rana` gana un segundo tipo de obstáculo de río (tortugas que se hunden en un ciclo) y su multiplicador de velocidad deja de tener techo a partir de este spec.
7. Pasada manual (ver criterios de aceptación).

## Acceptance criteria

- [ ] Los carriles de río en las filas 3 y 5 muestran tortugas, visualmente distintas de los troncos; las filas 1, 2 y 4 siguen con troncos, sin cambios de comportamiento.
- [ ] Cada tortuga cicla, sin intervención del jugador, entre "a flote", "a punto de hundirse" y "hundida", de forma visible por su color.
- [ ] Pararse sobre una tortuga hundida (`down`) pierde una vida, igual que quedarse en agua sin tronco.
- [ ] Pararse sobre una tortuga a flote (`up`) o en aviso (`warning`) sostiene a la rana igual que un tronco, incluido el arrastre horizontal con la velocidad del carril.
- [ ] En un mismo carril de tortugas, no todos los grupos se hunden al mismo tiempo (fase inicial desincronizada).
- [ ] El multiplicador de velocidad de carriles sigue subiendo más allá de `2.5×` en niveles altos (verificable llegando al menos a nivel 15 en una partida de prueba).
- [ ] El resto de la mecánica de SPEC 01 y SPEC 02 (coches, troncos de los otros 3 carriles, nenúfares, puntuación por avance, vidas, sonido, pausa, fin de partida) sigue igual.
- [ ] Todos los criterios de aceptación de SPEC 01 y SPEC 02 siguen pasando, salvo el techo de `2.5×` de SPEC 01, que este spec supera de forma explícita.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisions taken and discarded

- **Sí: solo 2 de los 5 carriles de río con tortugas.** Da variedad sin convertir el río entero en un ejercicio de memorización; los otros 3 carriles siguen siendo troncos predecibles, que es lo que permite seguir avanzando con seguridad relativa.
- **Sí: fase inicial aleatoria por grupo de tortugas.** Sin esto, todos los grupos de un carril se hundirían en sincronía y el carril sería "seguro" o "letal" en bloque, en vez de exigir mirar cada grupo por separado.
- **Sí: quitar el techo de velocidad.** Es una plataforma de puntuación más alta; un techo fijo convierte los niveles altos en "más de lo mismo" en vez de un reto real, y el `check` de `scores.score` admite hasta 100.000.000 — sobra margen antes de que esto sea un problema práctico.
- **No: sonido de aviso al hundirse.** Ya existe el "ahogo" de `02-sonidos-rana.md` para cuando la rana muere sobre una tortuga hundida; un sonido nuevo por cada transición de fase mezclaría el scope de un spec de dificultad con uno de sonido.
- **No: cocodrilos ni power-ups.** No se pidieron, y no son variantes de "carril" sino un tipo de peligro nuevo en la fila de meta — otro spec, si llega.
- **No: hacer configurable el ciclo de las tortugas.** Son constantes fijas (`3000/800/1500 ms`), igual que los multiplicadores de nivel fijos de `bloques`.
- **No: extender la variedad a los carriles de carretera en este spec.** El pedido y el nombre de este spec son "dificultad de carriles del río"; una segunda variante de coche es una capacidad distinta, nombrable por separado si se pide.

## Identified risks

| Riesgo                                                                                                              | Mitigación                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El multiplicador sin techo puede volver el juego injugable en niveles muy altos.                                    | Aceptado a propósito: el objetivo es una escalada de dificultad real; alcanzar ese punto ya es en sí un logro de puntuación, no un error del juego.                                                                     |
| La fase aleatoria de las tortugas podría, por mala suerte, dejar un carril sin ninguna a flote durante un instante. | Duración de `up` (3000 ms) frente a `warning + down` (2300 ms): en promedio, más de la mitad del ciclo cada tortuga está a flote, así que un carril completo sin ninguna a flote es estadísticamente raro y momentáneo. |
| Distinguir "warning" de "down" solo por color puede ser difícil de leer a velocidades altas.                        | Aceptado para este spec; si el playtest lo pide, ajustar el color o el contraste es un cambio de constante, no un spec nuevo.                                                                                           |
| Cambiar `kind` de un carril de río podría romper la función que decide `dir`/`speed`/`gap` de SPEC 01.              | `RiverLane` extiende la interfaz `Lane` de SPEC 01 en vez de reemplazarla; `dir`/`speed`/`gap`/envoltura en los bordes no cambian de forma ni de significado, solo el chequeo de soporte.                               |

## Qué **no** entra en este spec

- Sonido de aviso al hundirse.
- Cocodrilos, power-ups u otros peligros de meta.
- Carriles de carretera con variantes nuevas.
- Ciclo de hundimiento configurable.

Cada uno, si llega, va en su propio spec.
