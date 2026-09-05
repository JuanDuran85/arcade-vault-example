# SPEC 02 — Homepage y Acerca de

> **Status:** Aprobado
> **Depends on:** SPEC 01
> **Date:** 2026-09-04
> **Objective:** Portar como rutas reales de Next.js las pantallas de Inicio (Home) y Acerca de del prototipo de referencia (`references/home-about/`), moviendo la Biblioteca de `/` a `/biblioteca` y actualizando el nav compartido con las 4 secciones del sitio.

---

## Por qué existe este spec

Spec 01 implementó `/` como la Biblioteca porque el prototipo original (`references/templates/`) no incluía Home ni Acerca de. `references/home-about/` sí las define (`home.jsx`, `about.jsx`, `nav.jsx` con 4 enlaces: Inicio, Biblioteca, Salón de la Fama, Acerca de). Este spec cierra ese hueco: introduce `/` como landing real, mueve la Biblioteca a `/biblioteca`, agrega `/acerca-de`, y actualiza `components/nav.tsx` para que coincida con `nav.jsx`.

## Scope

**In:**

- `/` (Home): hero con silhouettes SVG decorativas, sección "¿Por qué Arcade Vault?" (4 feature cards), preview de 6 juegos desde `GAMES` (mini-cards), sección de stats estáticos, "Actividad en vivo" (ticker de puntuaciones + top jugadores, ambos con datos fijos como en la referencia, no calculados), sección de precios (plan único gratis + FAQ), CTA final.
- `/acerca-de` (About): hero de misión, fila de 3 "highlights", banner divisor decorativo, formulario de contacto (nombre/email/mensaje) que simula el envío en el cliente (animación de "terminal" de éxito), sin backend ni persistencia.
- Mover la Biblioteca actual (`app/page.tsx`) a `app/biblioteca/page.tsx` sin cambios de comportamiento.
- Actualizar `components/nav.tsx` (desktop + panel móvil) para los 4 enlaces: Inicio (`/`), Biblioteca (`/biblioteca`), Salón de la Fama (`/salon-de-la-fama`), Acerca de (`/acerca-de`).
- Todos los CTA de Home/About que en la referencia navegan a "biblioteca" apuntan a `/biblioteca`; los que navegan a "auth" apuntan a `/iniciar-sesion`.
- Portar a `app/globals.css` las clases de `references/home-about/styles.css` que usan Home/About (hero, feature-grid, mini-rail, stats, activity-grid, pricing-grid, about-hero, contact-form, etc.), respetando el tema y breakpoints ya existentes.
- Animación `reveal`/`IntersectionObserver` al hacer scroll, igual que en `home.jsx`/`about.jsx`.

**Out of scope (for future specs):**

- Envío real de mensajes de contacto (email, API, base de datos).
- Cualquier pago o checkout real (la sección de precios es puramente informativa, el plan es gratis).
- Datos reales/dinámicos para el ticker de actividad o el top de jugadores de Home (quedan hardcodeados como en la referencia).
- Cambios a las pantallas ya implementadas en spec 01 (Detalle, Reproductor, Auth, Salón de la Fama) más allá de lo necesario en `components/nav.tsx`.
- Sonido/música, pruebas automatizadas (no hay test runner configurado).

## Data model

Ninguno nuevo. Se reutiliza `GAMES` de `lib/data.ts` (spec 01) para el preview de 6 juegos en Home (`GAMES.slice(0, 6)`). Los arrays de ticker/top-jugadores/features/FAQ de Home y los highlights de About quedan como constantes locales dentro de sus componentes, igual que en la referencia — no se tipan como entidades de dominio porque son contenido decorativo fijo.

## Implementation plan

1. Mover `app/page.tsx` a `app/biblioteca/page.tsx` (mismo contenido, sin cambios). `npm run build` sigue pasando; `/biblioteca` muestra la Biblioteca, `/` da 404 temporalmente.
2. Editar `components/nav.tsx`: agregar enlaces "Inicio" (`/`) y "Acerca de" (`/acerca-de`), cambiar "Biblioteca" a `/biblioteca`, ajustar `isActive` (Inicio activo solo en `/`; Biblioteca activo en `/biblioteca` y `/juego/*`) en desktop y panel móvil.
3. Crear `app/page.tsx` (Home, cliente): portar `home.jsx` completo — hero, `FloatingSilhouettes`, `useReveal`, feature cards, mini-rail de `GAMES.slice(0, 6)` enlazando a `/juego/[id]`, stats, activity grid (ticker + top jugadores, ambos hardcodeados), pricing + FAQ, CTA final. Todos los CTAs de biblioteca → `/biblioteca`, de auth → `/iniciar-sesion`; "VER SALÓN" → `/salon-de-la-fama`.
4. Crear `app/acerca-de/page.tsx` (About, cliente): portar `about.jsx` — hero de misión, highlights, banner divisor, formulario de contacto con validación de campos no vacíos y simulación de éxito en cliente (sin persistencia).
5. Portar a `app/globals.css` las clases de `references/home-about/styles.css` usadas por Home/About (prefijos `.home-*`, `.about-*`, `.feature-*`, `.mini-*`, `.activity-*`, `.pricing-*`, `.contact-*`, `.highlight*`, `.terminal-success`, animaciones `reveal`/`.in`), sin duplicar clases ya existentes de spec 01.
6. Pasada manual: recorrer `/`, `/biblioteca`, `/acerca-de` y el nav (desktop + móvil) en un viewport angosto; confirmar que `npm run lint` y `npm run build` terminan sin errores.

## Acceptance criteria

- [ ] `npm run build` termina sin errores de TypeScript ni de ESLint.
- [ ] `npm run lint` pasa sin errores.
- [ ] `/` muestra la Home con hero, features, preview de 6 juegos, stats, actividad en vivo, precios y CTA final.
- [ ] `/biblioteca` muestra la Biblioteca (buscador + filtro de categoría) igual que antes en `/`.
- [ ] `/acerca-de` muestra la misión, highlights y el formulario de contacto; enviar el formulario con campos vacíos hace "shake" sin enviar; con campos completos muestra la animación de terminal de éxito.
- [ ] El nav (desktop y panel móvil) muestra Inicio, Biblioteca, Salón de la Fama y Acerca de, cada uno navegando a su ruta y marcándose activo correctamente.
- [ ] "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS →" y "EMPEZAR GRATIS →" navegan a `/biblioteca` o `/iniciar-sesion` según corresponda; una tarjeta de juego del preview navega a `/juego/[id]`.
- [ ] "VER SALÓN →" en la card de top jugadores navega a `/salon-de-la-fama`.
- [ ] Las animaciones `reveal` (fade/slide al hacer scroll) funcionan en Home y About.

## Decisions taken and discarded

- **`/` pasa a ser Home y la Biblioteca se mueve a `/biblioteca`** (en vez de dejar `/` como Biblioteca y meter Home en otra ruta): coincide con el nav de referencia y evita un enrutado que no calza con el prototipo.
- **Ruta `/acerca-de`** en vez de `/about`: mantiene la convención en español ya usada por `/iniciar-sesion` y `/salon-de-la-fama`.
- **Ticker de actividad y top jugadores quedan hardcodeados**, no calculados desde `seededScores`/`GAMES`: mismo alcance "solo visual" de spec 01, evita introducir lógica que la referencia no tiene.
- **Formulario de contacto sin backend ni persistencia**: simulación de éxito puramente en cliente, igual que la referencia; no se agrega una nueva clave de `localStorage`.
