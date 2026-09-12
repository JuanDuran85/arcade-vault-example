# SPEC 11 — Controles táctiles para jugar en móvil

> **Status:** Approved
> **Depends on:** SPEC 07, SPEC 10
> **Date:** 2026-09-12
> **Objective:** Pintar en `/juego/[id]/jugar`, solo en pantallas táctiles, un gamepad por juego cuyos botones despachan `KeyboardEvent` sintéticos a `window`, para que los cuatro juegos se jueguen en móvil sin tocar sus módulos.

---

## Por qué existe este spec

Los cuatro juegos (`rocas`, `caida`, `bloques`, `snake`) leen **solo teclado**: listeners `keydown`/`keyup` en `window` (`bloques` añade `mousemove`, que en táctil no existe). En un móvil no hay teclado, así que hoy la partida arranca y no se puede mover nada.

La salida más barata: los juegos ya escuchan `window`, así que un botón en pantalla que haga `window.dispatchEvent(new KeyboardEvent("keydown", { key, code }))` es indistinguible, para ellos, de una tecla real. Ninguno mira `isTrusted`. **Cero cambios en `lib/games/*.ts` salvo `registry.ts`.**

## Scope

**In:**

- Campo nuevo **obligatorio** `touch: TouchButton[]` en `GameEntry` (`lib/games/registry.ts`), declarado para los cuatro juegos.
- Componente `TouchPad` dentro de `app/juego/[id]/jugar/client.tsx` (mismo archivo, como `GameCanvas`) que pinta un botón por entrada de `entry.touch`, bajo el marco CRT.
- Cada botón: `pointerdown` → `keydown` sintético; `pointerup` / `pointercancel` / `pointerleave` → `keyup` sintético. Mantener pulsado = tecla mantenida (necesario para `rocas` y `bloques`, que leen estado de teclas en cada frame).
- Visibilidad solo por CSS: `@media (pointer: coarse)` muestra `.touch-pad`; fuera de ella está oculto. Sin JS, sin toggle, sin `localStorage`.
- Layout móvil de la pantalla de juego en `app/globals.css`: que `.player-hud` / `.hud-actions` hagan wrap y que `.av-player` / `.crt` reduzcan su padding en anchos estrechos, para que el canvas (ya `width:100%` en una caja 4/3) quepa en el viewport sin scroll horizontal.

**Out of scope (para specs futuros):**

- Gestos sobre el canvas (swipe en `snake`, arrastre de paleta en `bloques`).
- `touch-action: none` / bloqueo de scroll y zoom por doble toque (ver Riesgos).
- Forzar o sugerir orientación horizontal.
- El canvas 800×800 de `snake` dentro de la caja 4/3: es un tema de layout previo, no de táctil.
- Método de entrada nuevo en `GameHandle` (p. ej. `input(action, down)`).
- Vibración / feedback háptico.

## Data model

En `lib/games/registry.ts`:

```ts
export interface TouchButton {
  label: string; // texto del botón, en español
  code: KeyboardEvent["code"]; // "ArrowLeft", "Space"…; `key` se deriva: "Space" → " ", el resto key === code
}

interface GameEntry {
  // …campos actuales
  touch: TouchButton[]; // gamepad táctil; obligatorio para que un juego nuevo no lo olvide
}
```

Botones por juego (orden = orden en pantalla):

| Juego     | Botones                                                                       |
| --------- | ----------------------------------------------------------------------------- |
| `rocas`   | `←` ArrowLeft · `→` ArrowRight · `↑` ArrowUp · `DISPARAR` Space               |
| `caida`   | `←` ArrowLeft · `→` ArrowRight · `↑` ArrowUp · `↓` ArrowDown · `SOLTAR` Space |
| `bloques` | `←` ArrowLeft · `→` ArrowRight                                                |
| `snake`   | `↑` ArrowUp · `↓` ArrowDown · `←` ArrowLeft · `→` ArrowRight                  |

`bloques` compara `e.key` y los otros tres `e.code`; como se envían ambos, sirve para los cuatro.

Sin persistencia ni datos nuevos en Supabase.

## Implementation plan

1. **`registry.ts`:** exportar `TouchButton`, añadir `touch` obligatorio a `GameEntry` y los cuatro arrays de la tabla. `npx tsc --noEmit` pasa.
2. **`client.tsx`:** componente `TouchPad({ buttons })` con un `<button type="button" className="btn">` por entrada y los handlers de puntero descritos en Scope; se renderiza tras `.game-controls`. En escritorio aún no se ve nada porque falta el CSS.
3. **`globals.css`:** `.touch-pad { display: none }` + `@media (pointer: coarse) { .touch-pad { display: flex; … } }` con botones grandes (≥ 48px de alto) y `user-select: none`.
4. **`globals.css`:** ajustes de layout móvil (`flex-wrap` en `.player-hud` y `.hud-actions`, padding reducido de `.av-player` y `.crt` bajo `max-width: 600px`).
5. **Verificación manual** en Chrome DevTools, emulación de dispositivo táctil a 390px, jugando los cuatro juegos (ver criterios).
6. **`CLAUDE.md`:** una línea en **Data & session** sobre `touch` en `registry.ts` y el mecanismo de teclas sintéticas; añadir "y `touch`" a la regla de alta de un juego nuevo.

## Acceptance criteria

- [ ] `GameEntry.touch` es obligatorio; quitarlo de cualquier entrada rompe `tsc`.
- [ ] `git diff` no toca `asteroids.ts`, `caida.ts`, `bloques.ts` ni `snake.ts`.
- [ ] En escritorio (`pointer: fine`) la pantalla de juego se ve igual que antes: no hay gamepad.
- [ ] En emulación táctil a 390px de ancho no hay scroll horizontal y el canvas completo es visible.
- [ ] `rocas`: mantener `←` rota de forma continua, `↑` propulsa mientras está pulsado, `DISPARAR` dispara.
- [ ] `caida`: `← → ↑ ↓` mueven/rotan/bajan la pieza y `SOLTAR` la deja caer.
- [ ] `bloques`: mantener `←`/`→` mueve la paleta y se detiene al soltar.
- [ ] `snake`: las cuatro flechas cambian la dirección.
- [ ] Arrastrar el dedo fuera de un botón pulsado detiene la acción (no queda "tecla pegada").
- [ ] Con PAUSA activa, los botones no mueven nada (lo garantiza el `setPaused` de cada juego).
- [ ] `npm run lint` y `npx tsc --noEmit` pasan.

## Decisions taken and discarded

- **Teclas sintéticas en vez de API en `GameHandle`.** Elegido: cero cambios en los cuatro módulos. Descartado `handle.input()`: más limpio, pero toca el contrato y los cuatro juegos para obtener el mismo resultado.
- **Descartados gestos sobre el canvas:** lógica distinta en cada juego; se puede añadir encima más adelante.
- **Botones por juego declarados en `registry.ts`**, no un D-pad genérico: evita botones inútiles (p. ej. `↑`/`↓` en `bloques`) y mantiene `registry.ts` como único punto de alta de un juego.
- **`touch` obligatorio, no opcional** (a diferencia de `sound?`/`skins?`): todo juego debe poder jugarse en móvil, y el compilador lo recuerda.
- **Visibilidad por `@media (pointer: coarse)`**, no por toggle ni por ancho de pantalla: una tablet con teclado o un portátil estrecho no lo necesitan; un móvil sí.
- **Solo `code` en los datos, `key` derivado:** en flechas `key === code`; `Space` es la única excepción.
- **Descartado en este spec:** `touch-action: none`, orientación forzada y arrastre en `bloques` (el usuario no los incluyó).

## Identified risks

- **Doble toque = zoom / pulsación larga = menú contextual** en iOS/Android: al no incluir `touch-action`, tocar rápido dos veces un botón podría hacer zoom. Si aparece en la verificación del paso 5, añadir `touch-action: manipulation` a `.touch-pad button` (una línea) o abrir un spec aparte.
- **`pointerdown` en navegadores sin Pointer Events:** todos los móviles actuales los soportan; no se añade fallback `touchstart`.
- **Multitoque** (rotar y disparar a la vez en `rocas`): los Pointer Events son independientes por dedo, así que debería funcionar; verificarlo en el paso 5.
- **Un juego futuro que ignore eventos sin `isTrusted`** rompería el mecanismo en silencio. Hoy ninguno lo hace.
