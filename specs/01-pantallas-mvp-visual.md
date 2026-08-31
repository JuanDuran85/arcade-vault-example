# SPEC 01 — Pantallas visuales MVP de Arcade Vault

> **Status:** Draft
> **Depends on:** Ninguno
> **Date:** 2026-08-30
> **Objective:** Implementar como rutas reales de Next.js App Router las cinco pantallas del prototipo de referencia (Biblioteca, Detalle de juego, Reproductor, Inicio de sesión y Salón de la Fama), solo a nivel visual y sin lógica de juego real, reutilizando el tema retro ya portado en `app/globals.css`.

---

## Por qué existe este spec

El prototipo de referencia (`references/templates/*.jsx`) es una SPA de una sola página con enrutado por hash y todo el estado (ruta, sesión) en un único `useState` de `app.jsx`. Este spec lo traduce a rutas reales de App Router — cada pantalla es su propia página — y define cómo se comparte el estado de sesión mock entre ellas sin ese árbol de estado único. También fija el límite de "solo visual, sin juego": la pantalla de reproductor conserva la simulación decorativa del prototipo (temporizador de puntuación, animación CSS), que es presentación, no un motor de juego.

## Scope

**In:**

- 5 rutas: `/` (Biblioteca), `/juego/[id]` (Detalle), `/juego/[id]/jugar` (Reproductor), `/iniciar-sesion` (Inicio de sesión) y `/salon-de-la-fama` (Salón de la Fama).
- `Nav` compartido (enlaces de escritorio, panel hamburguesa móvil, contador de créditos, píldora de usuario / botón de inicio de sesión) renderizado desde `app/layout.tsx`.
- Footer compartido en `app/layout.tsx` con el texto de `app.jsx` ("© 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0").
- Sesión simulada: iniciar sesión con cualquier usuario/contraseña crea un usuario falso guardado en `localStorage` (`av_user`); "jugar como invitado" no crea sesión; cerrar sesión la borra. Los botones de Google/GitHub son decorativos e inertes.
- Guardado de puntuación simulado: al terminar la demo del reproductor, introducir iniciales y guardar escribe una entrada en `localStorage` (`av_scores`); no se vuelve a leer en ningún otro sitio.
- La pantalla de Reproductor conserva la simulación decorativa del prototipo (la puntuación sube sola con un temporizador, pausa/reanudar, fin forzado, animación CSS del CRT y la "game-arena").
- Buscador y filtro de categoría en Biblioteca; pestañas en Salón de la Fama y en Inicio de sesión (entrar / crear cuenta).
- Layout responsive con los mismos breakpoints ya definidos en `app/globals.css`.
- Datos de juegos (`GAMES`, `CATS`, `PLAYERS`, `seededScores`) portados desde `references/templates/data.jsx` a un `lib/data.ts` tipado.

**Out of scope (for future specs):**

- Cualquier lógica/motor/canvas real para los 8 juegos.
- Autenticación o backend real (rutas de API, base de datos, hashing de contraseñas, OAuth real de Google/GitHub).
- Persistencia de puntuaciones compartida entre usuarios (servidor).
- Conectar la puntuación guardada en `localStorage` del usuario con las listas del Salón de la Fama / Detalle (se quedan con los datos ficticios/seed, igual que la referencia).
- Sonido/música.
- Pruebas automatizadas (no hay test runner configurado en el repo).
- Cualquier pantalla que no exista en `references/templates/` (perfil, ajustes, créditos, etc.).

## Data model

`lib/types.ts`:

```ts
export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: string; // sufijo de clase CSS, p. ej. "cover-bricks"
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // dd/mm/aaaa
}

export interface SessionUser {
  name: string;
}
```

`lib/data.ts` exporta `GAMES: Game[]`, `CATS` (incluye `"TODOS"` + las 4 categorías), `PLAYERS: string[]` y `seededScores(seed, count?): ScoreRow[]` — el mismo algoritmo pseudoaleatorio de `data.jsx`, tipado, para que los números coincidan con la referencia.

Claves de `localStorage` (se mantienen igual que en la referencia):

- `av_user` → JSON de `SessionUser | null`.
- `av_scores` → JSON array de `{ game: string; score: number; name: string; at: number }`.

## Implementation plan

1. Crear `lib/types.ts` y `lib/data.ts` (portados de `references/templates/data.jsx`, tipados). Sin cambios de UI todavía; `npm run build` sigue pasando.
2. Crear `lib/session.tsx`: `SessionProvider` (React Context, cliente) + hook `useSession()` respaldado por `localStorage["av_user"]`, con `user`, `login(user)`, `logout()`; añadir `saveScore(entry)` que escribe en `localStorage["av_scores"]`.
3. Crear `components/nav.tsx` (cliente): portar `nav.jsx` — enlaces de escritorio, contador de créditos, hamburguesa + panel móvil, botón de inicio de sesión / píldora de usuario usando `useSession()` y `next/link` + `usePathname()` para el estado de enlace activo.
4. Editar `app/layout.tsx`: envolver `children` con `SessionProvider`, renderizar `<Nav />` sobre `<main className="av-main">`, añadir el footer de `app.jsx`. `npm run dev` ya muestra nav + footer sobre la home actual (placeholder).
5. Reemplazar `app/page.tsx` por la pantalla de Biblioteca (cliente): hero, buscador, chips de categoría, grid responsive de `components/game-card.tsx` (nuevo, cliente, con el efecto de inclinación al mover el ratón de `biblioteca.jsx`), cada tarjeta enlaza a `/juego/[id]`.
6. Crear `app/juego/[id]/page.tsx` (Detalle, componente de servidor — no necesita estado de cliente): portada, tags, descripción, tira de estadísticas, leaderboard lateral (vía `seededScores`), "JUGAR AHORA" hacia `/juego/[id]/jugar`, "VOLVER AL VAULT" hacia `/`. Consultar la API actual de `params` para segmentos dinámicos en `node_modules/next/dist/docs/01-app/` antes de escribir esta ruta, según exige `AGENTS.md`.
7. Crear `app/juego/[id]/jugar/page.tsx` (Reproductor, cliente): HUD, CRT + animación decorativa de la "game-arena", controles de pausa/fin/reiniciar, modal de fin de partida con input de iniciales que llama a `saveScore`, "SALIR" vuelve a `/juego/[id]`.
8. Crear `app/iniciar-sesion/page.tsx` (Auth, cliente): pestañas entrar/crear cuenta, formulario que llama a `useSession().login(...)` y redirige a `/`, botón "jugar como invitado", botones decorativos de Google/GitHub.
9. Crear `app/salon-de-la-fama/page.tsx` (Salón de la Fama, cliente): pestañas por juego, podio (top 3), tabla completa, fila "tu mejor marca" cuando hay sesión, "VOLVER A LA BIBLIOTECA" hacia `/`.
10. Pasada manual: recorrer las 5 pantallas y el panel de nav móvil en un viewport angosto, confirmar que `npm run lint` y `npm run build` terminan sin errores.

## Acceptance criteria

- [ ] `npm run build` termina sin errores de TypeScript ni de ESLint.
- [ ] `npm run lint` pasa sin errores.
- [ ] `/` muestra la Biblioteca con los 8 juegos de `lib/data.ts`; escribir en el buscador filtra por título; pulsar un chip de categoría filtra por categoría.
- [ ] Pulsar una tarjeta de juego navega a `/juego/[id]` y muestra título, descripción, estadísticas y un leaderboard seed de 10 filas de ese juego.
- [ ] "JUGAR AHORA" en Detalle navega a `/juego/[id]/jugar`; la puntuación ahí sube sola cada ~220ms mientras no está en pausa.
- [ ] Pulsar "PAUSA" detiene la subida de puntuación y muestra el overlay "EN PAUSA"; pulsar de nuevo ("REANUDAR") la reanuda.
- [ ] Pulsar "FIN" abre el modal de fin de partida con la puntuación final; introducir iniciales y pulsar "GUARDAR PUNTUACIÓN" escribe una entrada en `localStorage["av_scores"]` y muestra la confirmación de guardado.
- [ ] `/iniciar-sesion` permite enviar cualquier usuario/contraseña y vuelve a `/` con el nav mostrando ese nombre de usuario en vez de "Iniciar Sesión".
- [ ] "JUGAR COMO INVITADO" en `/iniciar-sesion` vuelve a `/` sin crear sesión de usuario.
- [ ] Cerrar sesión (pulsando la píldora de usuario en el nav) borra `localStorage["av_user"]` y el nav vuelve a mostrar "Iniciar Sesión".
- [ ] `/salon-de-la-fama` muestra podio y tabla completa según el juego seleccionado en las pestañas, más una fila "tu mejor marca" solo cuando hay sesión de usuario.
- [ ] En un viewport menor a 840px, los enlaces de escritorio del nav se ocultan y la hamburguesa abre el panel móvil deslizante.

## Decisions

- **Sí:** rutas reales de Next.js App Router con slugs en español (`/juego/[id]`, `/iniciar-sesion`, `/salon-de-la-fama`) en vez del router por hash de una sola página de la referencia. Coherente con las convenciones de Next.js y con que todo el copy de la UI está en español. _(confirmado por el usuario)_
- **No:** slugs en inglés (`/games/[id]`, `/login`, `/hall-of-fame`). Descartado por el usuario para mantener el idioma de la URL alineado con el de la interfaz.
- **Sí:** conservar en el Reproductor la simulación decorativa de puntuación/CRT-arena de la referencia. Es solo presentación (animación CSS + un `setInterval` que incrementa un número), no un motor de juego, así que sigue dentro de "solo visual, sin juego". _(confirmado por el usuario)_
- **No:** congelar la pantalla de Reproductor y añadir un botón manual de "simular fin de partida". Descartado por el usuario — perdería la sensación pretendida de la pantalla sin reducir alcance real.
- **Sí:** reutilizar `app/globals.css` como única fuente de estilos en vez de reconstruir los efectos retro con utilities/tokens de Tailwind. El commit previo de esta rama ya portó ahí la hoja de estilos completa de la referencia, y los efectos CRT/scanline/neón no mapean bien a utilities. _(confirmado por el usuario)_
- **No:** reconstruir el look con tokens `@theme` de Tailwind v4 y clases utility. Descartado por el usuario por ser rehacer trabajo ya portado.
- **Sí:** sesión (`av_user`) y puntuaciones guardadas (`av_scores`) 100% simuladas en `localStorage`, igual que la referencia — sin auth real, sin servidor, sin conectar las puntuaciones guardadas a ningún leaderboard. _(confirmado por el usuario)_
- **No:** leer las puntuaciones guardadas del usuario de vuelta en el Salón de la Fama / Detalle. Descartado por el usuario para mantener paridad con los datos de leaderboard ficticios/seed de la referencia.
- **Sí:** compartir el estado de sesión entre páginas con un React Context pequeño (`lib/session.tsx`) en vez del `useState` raíz único de la referencia, ya que cada pantalla es ahora su propia ruta en vez de un único árbol de estado de SPA.
- **No:** una librería de estado (Zustand/Redux) para la sesión. Un solo valor (`user`) respaldado por `localStorage` no la necesita.
- **Sí:** `/` renderiza directamente la pantalla de Biblioteca (sin una ruta `/biblioteca` separada). Igual que la referencia, donde la biblioteca es la pantalla por defecto/home.
- **No:** pruebas automatizadas para este spec. El repo no tiene test runner configurado todavía (según `CLAUDE.md`) y el trabajo es puramente visual; la verificación es la pasada manual de los criterios de aceptación.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| La API de `params` para rutas dinámicas (`/juego/[id]`) puede diferir de versiones anteriores de Next.js | Consultar `node_modules/next/dist/docs/01-app/` antes de escribir la ruta, según exige `AGENTS.md`. |
| `localStorage` no disponible (modo privado) | Igual que en la referencia: los `try/catch` alrededor de cada lectura/escritura evitan que la app rompa; simplemente no persiste en ese caso. |

## What is **not** in this spec

- Cualquier lógica o motor real para los 8 juegos.
- Autenticación real (backend, base de datos, OAuth real).
- Persistencia de puntuaciones compartida entre usuarios.
- Sonido/música.
- Pruebas automatizadas.

Cada uno de estos, si se implementa, va en su propio spec.
