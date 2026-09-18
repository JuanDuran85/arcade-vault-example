# SPEC 16 — Hardening de seguridad (Supabase + Next.js)

> **Status:** Implementado
> **Depends on:** SPEC 04, SPEC 13, SPEC 14, SPEC 15
> **Date:** 2026-09-18
> **Objective:** Cerrar los 3 WARN de seguridad del linter de Supabase (revocar EXECUTE público en dos funciones `SECURITY DEFINER`, activar protección contra contraseñas filtradas), verificar que las políticas RLS de `games`/`scores` ya cumplen la postura deseada, y sumar tres protecciones del lado Next.js: security headers, validación de contraseña por regex en el cliente, y protección de ruta vía Proxy.

---

## Scope

**In:**

1. **Funciones `SECURITY DEFINER`** — migración `supabase/migrations/20260918000000_revoke_security_definer_execute.sql` que revoca `EXECUTE` de `PUBLIC` en `public.handle_new_user()` (SPEC 13) y `public.rls_auto_enable()` (función preexistente en la DB remota, no trackeada por ninguna migración local). Aplicada al proyecto remoto vía `apply_migration` (MCP de Supabase).
2. **RLS de `games` y `scores` — solo verificación, sin migración**: confirmar y documentar que `public.games` ya no admite insert/update/delete desde el cliente (RLS habilitado + cero policies de escritura = deny-by-default) y que `scores_insert_any` ya exige `user_id is null or user_id = auth.uid()`. Ningún cambio de schema.
3. **Security headers** — `next.config.ts`: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `X-DNS-Prefetch-Control: off` en todas las rutas.
4. **Validación de contraseña por regex en el cliente** — minúscula + mayúscula + dígito + símbolo + mínimo 8 caracteres, chequeada en `app/iniciar-sesion/page.tsx` (tab "Crear cuenta") y `app/actualizar-password/page.tsx` antes de llamar a Supabase, con mensaje de error en español.
5. **Protección de ruta vía Proxy** — `proxy.ts` (ya existe, hoy solo refresca sesión) gana la responsabilidad de redirigir a `/iniciar-sesion` si no hay sesión al visitar `/actualizar-password`.
6. Activar "Leaked Password Protection" manualmente en el dashboard de Supabase (Authentication → Providers → Password) — no hay tabla ni MCP tool en este proyecto para scriptearlo.
7. `CLAUDE.md`: documentar los headers, la regex de contraseña, la protección de `/actualizar-password`, el hallazgo de RLS ya-correcto, y el toggle manual de leaked-password.

**Out of scope (para specs futuros o descartado por decisión):**

- Cambiar `SECURITY DEFINER` a `SECURITY INVOKER` en cualquiera de las dos funciones — ambas necesitan privilegios elevados por diseño.
- **Borrar `rls_auto_enable()`** — evaluado y descartado (ver Decisions).
- **Restringir el insert de `scores` a solo usuarios autenticados** — evaluado y descartado (ver Decisions); rompería "JUGAR COMO INVITADO".
- CSP / `Strict-Transport-Security` — no pedidos en esta ronda; CSP en particular necesita auditar estilos inline y Turbopack antes de poder escribirse sin romper la app.
- Rate limiting propio — Supabase Auth ya limita intentos; no se duplica.
- Proteger con el proxy cualquier ruta más allá de `/actualizar-password` — el resto de la plataforma es pública por diseño (catálogo, leaderboard, juego como invitado).
- Automatizar el toggle de "Leaked Password Protection" — vive en la Management API, fuera del alcance de las herramientas disponibles aquí.

## Data model

Esta feature no introduce estructuras nuevas ni cambia policies existentes. Reutiliza `public.handle_new_user()` (SPEC 13), `public.rls_auto_enable()` (preexistente) y las policies de `games`/`scores` de SPEC 06, que se verifican pero no se tocan.

## Implementation plan

1. Crear `supabase/migrations/20260918000000_revoke_security_definer_execute.sql` con `REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;` y `REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;`, con un comentario corto notando que la segunda es infraestructura externa a este repo. Aplicar con `apply_migration`.
2. Verificación sin migración (vía `execute_sql`, MCP Supabase): confirmar que `pg_policies` no tiene ninguna fila `games` con `cmd` distinto de `SELECT`, y que la policy `scores_insert_any` sigue leyendo `user_id is null or user_id = auth.uid()`. Documentar el resultado en este spec y en `CLAUDE.md`.
3. Correr `get_advisors(type: "security")` y confirmar que `anon_security_definer_function_executable` y `authenticated_security_definer_function_executable` ya no aparecen.
4. `next.config.ts`: agregar `async headers()` devolviendo, para `source: "/(.*)"`:
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `X-DNS-Prefetch-Control: off`
5. Regex de contraseña (`/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/`) en un solo lugar reutilizable (junto a `translateAuthError` en `lib/session.tsx`, o un helper propio):
   - `app/iniciar-sesion/page.tsx`: en `submit`, si `tab === "up"` y la contraseña no cumple, `setError(...)` y `return` antes de llamar `signUp`.
   - `app/actualizar-password/page.tsx`: mismo chequeo antes de `updatePassword`, junto al chequeo existente de `pass !== confirm`.
6. `lib/supabase/middleware.ts`: después de `getUser()`, si `request.nextUrl.pathname === "/actualizar-password"` y no hay usuario, devolver `NextResponse.redirect(new URL("/iniciar-sesion", request.url))` en vez de `response`. `proxy.ts` no cambia (ya enruta todo a `updateSession`, y el matcher actual ya cubre `/actualizar-password`).
7. Pasada manual: en el dashboard de Supabase, Authentication → Providers → Password, activar "Leaked password protection". Confirmar con `get_advisors(type: "security")` que `auth_leaked_password_protection` desaparece.
8. Actualizar `CLAUDE.md` con los 5 puntos nuevos (headers, regex, protección de ruta, verificación RLS, toggle manual).
9. Pasada manual + automatizada: signup con contraseña débil (rechazo en la UI, sin red request a Supabase — revisar Network tab), signup con contraseña válida, login email/password, Google, GitHub, recuperar/actualizar contraseña (incluyendo visitar `/actualizar-password` sin sesión → redirect a `/iniciar-sesion`), jugar como invitado y guardar score (confirma que el insert anónimo sigue funcionando). `npm run lint` y `npm run build`.

## Acceptance criteria

- [X] La migración `revoke_security_definer_execute` existe en `supabase/migrations/` y aparece aplicada en `list_migrations`.
- [X] `get_advisors(type: "security")` ya no reporta `anon_security_definer_function_executable` ni `authenticated_security_definer_function_executable`.
- [X] `public.games` no tiene ninguna policy de insert/update/delete (verificado por query, documentado, sin migración).
- [X] `scores_insert_any` sigue permitiendo `anon` y `authenticated` con `user_id is null or user_id = auth.uid()` (documentado como ya-correcto).
- [X] Signup con un email nuevo sigue creando la fila correspondiente en `public.profiles`.
- [X] Login por email/password, Google y GitHub siguen funcionando sin regresión.
- [X] Toda respuesta HTTP incluye `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` y `X-DNS-Prefetch-Control: off`.
- [X] Crear cuenta con una contraseña que no cumple la regex muestra un error en español y **no** dispara `signUp` contra Supabase.
- [X] Actualizar contraseña con una que no cumple la regex muestra error y **no** dispara `updateUser`.
- [X] Visitar `/actualizar-password` sin sesión activa redirige a `/iniciar-sesion`.
- [X] Jugar como invitado y guardar un score sigue funcionando (el insert anónimo no se rompió).
- [X] "Leaked Password Protection" está activado en Authentication → Providers → Password del dashboard.
- [X] `get_advisors(type: "security")` ya no reporta `auth_leaked_password_protection`.
- [X] `CLAUDE.md` documenta los 5 puntos nuevos y el paso manual.
- [X] `npm run build` y `npm run lint` terminan sin errores.

## Decisions taken and discarded

- **Revocar de `PUBLIC` en vez de listar `anon`/`authenticated` explícitamente**: cubre los dos roles que reporta el linter y cualquier rol futuro; es la práctica estándar de Postgres para una función que solo debe dispararse como trigger.
- **No cambiar a `SECURITY INVOKER`**: ambas funciones necesitan privilegios elevados por diseño; cambiarlas rompería el trigger de creación de perfil y el event trigger de RLS.
- **No borrar `rls_auto_enable()`**: está enganchada al event trigger `ensure_rls` (`ddl_command_end`), el mecanismo con el que Supabase auto-activa RLS en cualquier tabla nueva de `public` en **todo el proyecto**, no solo Arcade Vault. Borrar la función rompería ese trigger para cualquier tabla futura. Revocar `EXECUTE` (paso 1) ya cierra el único vector que reporta el linter — invocación directa vía `/rest/v1/rpc/rls_auto_enable` — sin tocar esa red de seguridad.
- **No restringir el insert de `scores` a solo autenticados**: el policy actual (`user_id is null or user_id = auth.uid()`) ya impide que alguien firme el score de otro, que es la garantía real de seguridad. Sacar `anon` del policy rompería "JUGAR COMO INVITADO" (`handleGuest` en `app/iniciar-sesion/page.tsx`), comportamiento intencional documentado en `CLAUDE.md` ("anyone (signed in or not) inserts a score"). Se deja como está.
- **Headers en `next.config.ts`, no en `proxy.ts`**: son estáticos (no dependen del request ni de la sesión), así que van en la config declarativa de Next en lugar de código que corre en cada request.
- **Proteger solo `/actualizar-password` con el proxy**: es la única ruta de la plataforma que exige una sesión (de recuperación) para tener sentido; el resto es público por diseño.
- **Leaked password protection queda manual**: no hay tabla de Postgres ni MCP tool de Supabase en este proyecto para tocar la config de Auth a nivel de proyecto — mismo patrón que el toggle de "Confirm email" ya documentado en `CLAUDE.md`.

## What is **not** in this spec

- Cambios a `SECURITY DEFINER`/`SECURITY INVOKER` en las funciones, o a la lógica de `rls_auto_enable()`.
- Cambios de schema o de policies en `games`/`scores` (solo verificación).
- CSP, `Strict-Transport-Security`, o cualquier otro header no listado arriba.
- Rate limiting propio.
- Protección de rutas distintas a `/actualizar-password`.
- Automatización del toggle de leaked-password protection.
- Hallazgos de `get_advisors(type: "performance")`.

Cada uno de esos, si se necesita, va en su propia spec.
