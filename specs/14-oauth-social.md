# SPEC 14 — Login social (Google + GitHub)

> **Status:** Aprobado
> **Depends on:** SPEC 04, SPEC 13
> **Date:** 2026-09-17
> **Objective:** Conectar los botones GOOGLE y GITHUB de `app/iniciar-sesion/page.tsx`, hoy decorativos, a Supabase Auth OAuth real mediante una ruta de callback compartida.

---

## Por qué existe este spec

SPEC 04 dejó explícitamente los botones sociales sin proveedor configurado ("agregar OAuth real es una decisión de proveedor + configuración de callback URLs que... merece su propio spec"). Este es ese spec.

## Scope

**In:**

- `app/auth/callback/route.ts`: `route handler` (`GET`) que toma `code` de la query string, llama `supabase.auth.exchangeCodeForSession(code)` y redirige a `/`.
- `lib/session.tsx`: nuevo método `signInWithOAuth(provider: "google" | "github")` que llama `supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}/auth/callback` } })`.
- `app/iniciar-sesion/page.tsx`: los botones "◆ GOOGLE" y "▣ GITHUB" pasan de decorativos a `onClick={() => signInWithOAuth("google" | "github")}`.
- Nota en `CLAUDE.md` documentando el paso manual: crear la OAuth app en Google Cloud Console y en GitHub Developer Settings (redirect URI: `https://<proyecto>.supabase.co/auth/v1/callback`), y cargar client ID/secret en el dashboard de Supabase → Authentication → Providers → Google/GitHub.

**Out of scope (para specs futuros):**

- Otros proveedores (Facebook, Twitter/X, Discord, etc).
- Lógica propia de merge cuando el mismo email ya existe con password: se deja que Supabase lo resuelva (linkea por email si "Confirm email" sigue desactivado, como en SPEC 04).
- Editar o subir un avatar propio — `profiles.avatar_url` (SPEC 13) se llena solo con lo que traiga el trigger desde `raw_user_meta_data`.

## Data model

Esta feature no introduce estructuras nuevas. Reutiliza `public.profiles` de SPEC 13: el trigger `handle_new_user()` ya lee `raw_user_meta_data->>'avatar_url'`, y Google/GitHub sí completan esa clave en el perfil OAuth, así que no hace falta tocar la migración.

## Implementation plan

1. Pasada manual: crear la OAuth app en Google Cloud Console y en GitHub Developer Settings, cargar client ID/secret en el dashboard de Supabase, documentar los pasos en `CLAUDE.md`.
2. Crear `app/auth/callback/route.ts` con el intercambio código→sesión y redirect a `/`.
3. Agregar `signInWithOAuth` a `lib/session.tsx` y a `SessionContextType`.
4. Conectar los dos botones en `app/iniciar-sesion/page.tsx` a `signInWithOAuth("google")` / `signInWithOAuth("github")`.
5. Pasada manual: click en GOOGLE, autorizar, confirmar que vuelve logueado a `/`; repetir con GITHUB; confirmar que login por email/password (SPEC 04) sigue funcionando sin regresión. `npm run lint` y `npm run build`.

## Acceptance criteria

- [X] Click en GOOGLE redirige al consentimiento de Google y, al autorizar, vuelve logueado a `/`.
- [X] Click en GITHUB redirige al consentimiento de GitHub y, al autorizar, vuelve logueado a `/`.
- [X] `components/nav.tsx` muestra el nombre derivado del provider tras loguearse por OAuth.
- [X] La fila de `profiles` (SPEC 13) del usuario logueado por OAuth tiene `avatar_url` no nulo.
- [X] Iniciar sesión con correo + password (SPEC 04) sigue funcionando sin cambios.
- [X] `npm run build` y `npm run lint` terminan sin errores.

## Decisions taken and discarded

- **Una sola ruta de callback para ambos providers**: `exchangeCodeForSession` no necesita saber qué provider originó el código; una ruta por provider sería código repetido sin motivo.
- **Sin merge de cuentas propio**: construir esa lógica es trabajo no pedido; Supabase ya linkea por email cuando corresponde, y es el mismo comportamiento que SPEC 04 ya asume para signup por email.
- **Setup de las OAuth apps como paso manual documentado**: igual que "Confirm email" en SPEC 04, no hay API pública para crear una OAuth app de Google/GitHub desde código.

## Identified risks

| Riesgo                                                     | Mitigación                                                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Redirect URI mal configurada en Google/GitHub              | Paso manual documentado explícitamente con la URL exacta que exige Supabase.                          |
| Provider no habilitado todavía en el dashboard de Supabase | Falla de forma controlada (Supabase devuelve error), mismo patrón que las claves dummy de SPEC 03/04. |
