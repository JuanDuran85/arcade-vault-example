# SPEC 12 — Apariencia del gamepad MK-II

> **Status:** Approved
> **Depends on:** SPEC 11
> **Date:** 2026-09-12
> **Objective:** Reemplazar el aspecto del `TouchPad` de SPEC 11 por el del gamepad neón de `references/gamepad-assets/gamepad.html` (carcasa `.gp`, D-pad `.dp` con gema central, botones redondos `.ab`), usando solo los botones que cada juego declara en `touch`.

---

## Por qué existe este spec

SPEC 11 dejó un gamepad funcional pero con los `.btn` genéricos de la plataforma. `references/gamepad-assets/` trae el diseño final (captura `gamepad-neon.png`). Este spec **solo cambia la apariencia**: el mecanismo de `KeyboardEvent` sintéticos, la visibilidad por `@media (pointer: coarse)` y los handlers de puntero siguen igual.

## Scope

**In:**

- Carcasa `.gp` (degradado, doble borde cian, patrón de puntos `::after`, glow inferior) alrededor del D-pad y de los botones de acción.
- D-pad con teclas `.dp` (flechas SVG de la referencia, hundido + glow cian con `:active`) y **hub central con gema pulsante** (`pulse-led`).
- Botones de acción redondos `.ab` con letra en `--pixel`, anillo punteado y hundido con `:active`. `A` = magenta.
- Mapeo por juego (exacto donde se puede, mismo estilo donde no):

| Juego     | Gamepad                                      | ¿Exacto?           |
| --------- | -------------------------------------------- | ------------------ |
| `rocas`   | D-pad completo + hub · `A` (hint "Disparar") | Sí, sin `B`        |
| `caida`   | D-pad completo + hub · `A` (hint "Soltar")   | Sí, sin `B`        |
| `snake`   | D-pad completo + hub                         | Sí, sin `B` ni `A` |
| `bloques` | `←` `→` en fila, estilo `.dp`, sin hub       | Estilo, no forma   |

- Tamaños de la variante móvil de la referencia (`@media (max-width: 620px)` → se reusa el breakpoint existente `max-width: 600px`): `.dp` 46px, `.ab` 64px.
- Se conserva `.touch-hint` sobre el botón de acción, restilizado para la carcasa.

**Out of scope:**

- Botón `B`: ningún juego lo usa; no se pinta (ver Decisiones).
- Estado `.on` por teclado físico (el script de la referencia): el gamepad solo se ve con dedo, así que no hay teclado que reflejar. Solo `:active`.
- `:hover` de la referencia: no existe con `pointer: coarse`.
- Mostrar el gamepad en escritorio.
- Cambios en `lib/games/{asteroids,caida,bloques,snake}.ts`, en el mecanismo de envío de teclas o en `.touch-controls`.
- Cargar las fuentes de Google Fonts de la referencia: `--pixel` y los colores ya existen en `app/globals.css`.

## Data model

Sin estructuras nuevas. Único cambio de datos en `lib/games/registry.ts`:

```ts
// caida
{ label: "A", code: "Space", hint: "Soltar" }, // antes: { label: "SOLTAR", code: "Space" }
```

`TouchButton` no cambia. Sin persistencia.

## Implementation plan

1. **`registry.ts`:** SOLTAR de `caida` pasa a `label: "A"`, `hint: "Soltar"`. `npx tsc --noEmit` pasa.
2. **`client.tsx` (`TouchPad`):** envolver todo en `<div className="touch-pad gp">`; D-pad con `className="dp dp-up|dp-down|dp-left|dp-right"` y el `<svg className="dp-arrow">` de la referencia en lugar del texto de `label` (conservar `aria-label`); añadir `<div className="dp-hub" aria-hidden><span className="dp-hub-gem" /></div>` solo cuando el juego declara las cuatro flechas; los no-flecha como `<button className="ab a">` con `.ab-ring` + `.ab-letter`. Handlers de puntero sin cambios. Quitar `className="btn"` de estos botones.
3. **`globals.css`:** sustituir el bloque `.touch-dpad` / `.touch-actions` dentro de `@media (pointer: coarse)` por el CSS de la referencia (`.gp`, `.gp::before/::after`, `.dp*`, `.dp-hub*`, `@keyframes pulse-led`, `.ab*`), sin reglas `:hover` ni `.on`, con `touch-action: manipulation` y `user-select: none` en `.dp` y `.ab`. D-pad posicionado absoluto 156×156 como la referencia; variante `bloques` (sin hub, 2 teclas) en fila flex. Sin `display: none` fuera del media: `.touch-pad { display: none }` ya lo cubre.
4. **`globals.css`:** en el `@media (max-width: 600px)` existente, los tamaños móviles de la referencia (`.gp-dpad` 144px, `.dp` 46px y offsets 49px, `.ab` 64px).
5. **Verificación manual** en Chrome DevTools, emulación táctil a 390px, los cuatro juegos, comparando con `references/gamepad-assets/gamepad-neon.png`.
6. **`CLAUDE.md`:** actualizar la línea del gamepad táctil: estilo MK-II, `A` con hint para la acción, sin `B`.

## Acceptance criteria

- [ ] En `rocas`, `caida` y `snake` el D-pad se ve como en `gamepad-neon.png`: cruz de 4 teclas oscuras con flecha SVG y hub central con gema cian que pulsa.
- [ ] `rocas` y `caida` muestran un único botón redondo magenta `A` con su hint ("Disparar" / "Soltar"); ningún juego muestra `B`.
- [ ] `bloques` muestra solo `←` y `→`, con el mismo estilo `.dp`, sin hub.
- [ ] El conjunto va dentro de una carcasa `.gp` con borde cian, patrón de puntos y glow.
- [ ] Pulsar una tecla `.dp` la hunde y la ilumina en cian; pulsar `A` la hunde y muestra el anillo punteado.
- [ ] A 390px no hay scroll horizontal y el gamepad cabe entero.
- [ ] Los cuatro juegos siguen jugándose igual que con SPEC 11 (mantener, soltar, arrastrar fuera detiene la acción).
- [ ] En escritorio (`pointer: fine`) no se ve gamepad.
- [ ] `git diff` no toca `asteroids.ts`, `caida.ts`, `bloques.ts` ni `snake.ts`.
- [ ] `npm run lint` y `npx tsc --noEmit` pasan.

## Decisions taken and discarded

- **Omitir `B`** en vez de pintarlo inerte: un botón sin función confunde; el gamepad es "exacto" salvo por lo que el juego no usa.
- **`caida` usa `A` + hint "Soltar"**, igual que `rocas` con "Disparar": un único patrón de botón de acción.
- **`bloques` solo con `←` `→`** en lugar de un D-pad con `↑↓` deshabilitados: mismos motivos que SPEC 11 (sin botones inútiles).
- **Hub con gema solo con las cuatro flechas:** sin `↑↓` no hay cruz que centrar.
- **CSS copiado a `globals.css`**, no un archivo o componente nuevo: el `TouchPad` ya vive en `client.tsx` y los tokens ya existen.
- **Sin `.on` por teclado ni `:hover`:** el gamepad solo existe con `pointer: coarse`.
- **`touch-action: manipulation`** se incluye ya: era el riesgo abierto de SPEC 11 y los botones nuevos son de toque rápido.

## Identified risks

- **Ancho a 390px:** D-pad 144px + `A` 64px + paddings de `.gp` ≈ 300px; cabe, pero `.gp` no debe tener `max-width` fijo mayor que el viewport. Verificar en el paso 5.
- **`:active` en iOS Safari** no se activa sin un listener táctil; los botones ya tienen `onPointerDown`, lo que basta. Si no se ilumina, añadir clase `.on` desde los handlers existentes.
- **Animación `pulse-led` continua** sobre el canvas en móviles lentos: es solo `opacity`/`transform`, compuesta en GPU; aceptable.
