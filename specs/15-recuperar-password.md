# SPEC 15 — Recuperar contraseña

> **Status:** Aprobado
> **Depends on:** SPEC 04, SPEC 14
> **Date:** 2026-09-17
> **Objective:** Agregar el flujo "olvidé mi contraseña" con dos pantallas nuevas, reutilizando el callback de OAuth de SPEC 14 para completar el reset.

---

## Scope

**In:**

- Link "¿Olvidaste tu contraseña?" en el tab INICIAR SESIÓN de `app/iniciar-sesion/page.tsx`, debajo del campo de contraseña, que lleva a `/recuperar-password`.
- `app/recuperar-password/page.tsx`: formulario de un campo (email); al enviar llama a `resetPasswordForEmail(email)` y siempre muestra el mismo mensaje de confirmación ("Si el correo existe, vas a recibir un link"), exista o no la cuenta.
- `app/actualizar-password/page.tsx`: formulario de contraseña nueva + confirmación; al enviar llama a `updatePassword(newPassword)` y redirige a `/`.
- `lib/session.tsx`: dos métodos nuevos en `SessionContextType` — `resetPasswordForEmail(email)` (llama `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/actualizar-password` })`) y `updatePassword(newPassword)` (llama `supabase.auth.updateUser({ password: newPassword })`).
- `app/auth/callback/route.ts` (creado en SPEC 14): se extiende para leer `?next=` de la query string y redirigir ahí en vez de siempre a `/` (default `/` si no viene el parámetro).

**Out of scope (para specs futuros):**

- Rate limiting propio del envío de emails — Supabase ya lo limita a nivel de proyecto.
- Cualquier mensaje que revele si un email existe o no en el sistema (a propósito, por seguridad).
- Expiración/reenvío manual del link — se usa el comportamiento default de Supabase.

## Data model

Esta feature no introduce estructuras nuevas. Reutiliza `auth.users` (SPEC 04) y la ruta `app/auth/callback` (SPEC 14).

## Implementation plan

1. `lib/session.tsx`: agregar `resetPasswordForEmail` y `updatePassword` a `SessionContextType` y a la implementación del provider.
2. Extender `app/auth/callback/route.ts` (SPEC 14) para leer `searchParams.get("next")` y usarlo como destino del redirect final (default `/`).
3. Crear `app/recuperar-password/page.tsx`.
4. Crear `app/actualizar-password/page.tsx`.
5. Agregar el link "¿Olvidaste tu contraseña?" en `app/iniciar-sesion/page.tsx`.
6. Pasada manual: pedir el reset con un email real, abrir el link recibido, confirmar que llega a `/actualizar-password` con sesión temporal activa, definir contraseña nueva, cerrar sesión e iniciar sesión con la contraseña nueva. Confirmar que el login OAuth de SPEC 14 sigue redirigiendo a `/` sin el parámetro `next`. `npm run lint` y `npm run build`.

## Acceptance criteria

- [ ] "¿Olvidaste tu contraseña?" en el tab INICIAR SESIÓN lleva a `/recuperar-password`.
- [ ] Pedir el reset con un email que existe y con uno que no existe muestra exactamente el mismo mensaje de confirmación.
- [ ] El link del correo lleva a `/actualizar-password` con una sesión temporal activa.
- [ ] Definir una contraseña nueva en `/actualizar-password` y luego iniciar sesión con esa contraseña funciona.
- [ ] El login por Google/GitHub (SPEC 14) sigue redirigiendo a `/` sin regresión tras el cambio en `app/auth/callback/route.ts`.
- [ ] `npm run build` y `npm run lint` terminan sin errores.

## Decisions taken and discarded

- **Mismo mensaje exista o no la cuenta**: evita que alguien use el formulario para enumerar qué emails están registrados.
- **Reusar `app/auth/callback` con `?next=` en vez de una ruta de callback propia**: el intercambio código→sesión es idéntico al de OAuth; duplicarlo en una segunda ruta no aporta nada.
- **Sin rate limiting propio**: Supabase ya limita el envío de emails de auth a nivel de proyecto; agregar uno propio es trabajo no pedido para un límite que ya existe.
