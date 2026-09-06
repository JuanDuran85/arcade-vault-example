# SPEC 04 — Autenticación real con Supabase Auth

> **Status:** Approved
> **Depends on:** SPEC 01
> **Date:** 2026-09-05
> **Objective:** Reemplazar el login mock de `lib/session.tsx` (localStorage, sin password) por autenticación real con Supabase Auth (email + password), dejando el resto de la app (catálogo, scores, leaderboard) exactamente como está.

---

## Por qué existe este spec

`/iniciar-sesion` ya existe (SPEC 01) pero `login(name)` solo guarda un nombre en `localStorage`, sin verificar nada. Este spec conecta ese formulario a Supabase Auth de verdad: instala el SDK, crea los clientes browser/server/proxy que exige `@supabase/ssr`, y reescribe `lib/session.tsx` para que `user` salga de una sesión real. Todo lo demás (scores, catálogo de juegos, leaderboard) sigue siendo mock; eso es alcance de un spec futuro.

## Scope

**In:**

- Dependencias `@supabase/supabase-js` y `@supabase/ssr` en `package.json`.
- Skill de agente `supabase/agent-skills` instalada vía `npx skills add supabase/agent-skills`.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, documentadas en `.env.example` con valores dummy y en `CLAUDE.md`.
- `lib/supabase/client.ts` — cliente de browser (`createBrowserClient`).
- `lib/supabase/server.ts` — cliente de servidor (`createServerClient` + `cookies()` de `next/headers`).
- `lib/supabase/middleware.ts` — `updateSession(request)`: refresca el token de sesión vía `supabase.auth.getUser()`.
- `proxy.ts` en la raíz (no `middleware.ts`: en Next.js 16 la convención se renombró — ver `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`) que llama a `updateSession` en cada request, con `matcher` que excluye estáticos.
- `lib/session.tsx` reescrito: `SessionProvider` hidrata `user` desde Supabase (`getUser()` + `onAuthStateChange`), y expone `signIn(email, password)`, `signUp(email, password, name)` y `logout()` (async) en vez de `login(name)`. `SessionUser` sigue siendo `{ name: string }` para no tocar `components/nav.tsx`, `app/salon-de-la-fama/page.tsx` ni `app/juego/[id]/jugar/client.tsx`.
- `app/iniciar-sesion/page.tsx`: tab "INICIAR SESIÓN" pasa a pedir correo (no usuario) + password; tab "CREAR CUENTA" mantiene usuario (nombre visible) + correo + password; `submit` llama a `signIn`/`signUp`, muestra estado "ENTRANDO…"/"CREANDO…" y errores de Supabase traducidos a español con el mismo patrón visual que `app/acerca-de/page.tsx` (SPEC 03).
- Nota en `CLAUDE.md` sobre las nuevas variables de entorno y sobre desactivar "Confirm email" en el dashboard de Supabase (paso manual, una sola vez).

**Out of scope (para specs futuros):**

- Migrar `lib/data.ts` (catálogo de juegos, leaderboard) a tablas de Supabase — sigue siendo mock/seeded.
- `saveScore` sigue escribiendo en `localStorage` (`av_scores`), sin relacionarse con el usuario real de Supabase.
- Login social (Google/GitHub): los botones de `app/iniciar-sesion/page.tsx` siguen decorativos, sin proveedor OAuth configurado.
- "JUGAR COMO INVITADO": sigue siendo un simple `router.push` sin autenticación.
- Tabla `profiles` u otra tabla propia: el nombre visible se guarda en `user_metadata.name` de Supabase Auth, no en una tabla nueva.
- Recuperación de contraseña ("olvidé mi contraseña").
- Row Level Security / cualquier tabla de datos propia — no hay tablas propias en este spec.
- `SUPABASE_DB_PASSWORD`: sigue sin usarse, reservada para una futura conexión directa a Postgres.

## Data model

Ninguna tabla nueva. Este spec usa únicamente `auth.users`, administrada por Supabase.

```ts
// lib/types.ts — sin cambios
export interface SessionUser {
  name: string; // derivado de user_metadata.name ?? email
}
```

Mapeo Supabase `User` → `SessionUser`:

```ts
function toSessionUser(u: import("@supabase/supabase-js").User): SessionUser {
  return { name: (u.user_metadata?.name as string) ?? u.email ?? "JUGADOR" };
}
```

`signUp`/`signIn`/`logout` devuelven `{ error: string | null }` (mensaje en español ya listo para mostrar, nunca el mensaje crudo de Supabase) para que la pantalla de login lo renderice igual que hace `app/acerca-de/page.tsx` con el error de contacto.

## Implementation plan

1. `npm install @supabase/supabase-js @supabase/ssr` y `npx skills add supabase/agent-skills`. `npm run build` sigue pasando (nada más cambió todavía).
2. Agregar a `.env.example`: `NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_dummy_replace_me`; copiar a `.env.local`. Documentar ambas en `CLAUDE.md` junto con el paso manual de desactivar "Confirm email" (Authentication → Providers → Email, en el dashboard de Supabase) para que el signup deje logueado de inmediato.
3. Crear `lib/supabase/client.ts`: `createClient()` con `createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)`.
4. Crear `lib/supabase/server.ts`: `async function createClient()` con `createServerClient` + `await cookies()` de `next/headers`, implementando `getAll`/`setAll` (el `setAll` envuelto en try/catch porque escribir cookies desde un Server Component falla en silencio por diseño; `proxy.ts` es quien de verdad las refresca).
5. Crear `lib/supabase/middleware.ts`: `updateSession(request: NextRequest)` crea un cliente de servidor atado a las cookies del request/response y llama a `await supabase.auth.getUser()` (no `getSession()`, que no revalida contra el servidor) para refrescar el token; devuelve el `NextResponse` con las cookies actualizadas.
6. Crear `proxy.ts` en la raíz: `export async function proxy(request: NextRequest) { return updateSession(request); }` + `export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] }`.
7. Reescribir `lib/session.tsx`: crear el cliente browser una vez, hidratar `user` en `useEffect` con `supabase.auth.getUser()`, suscribirse a `supabase.auth.onAuthStateChange` (limpiar la suscripción al desmontar), y exponer `signIn`, `signUp`, `logout` (todas async, atrapan el error de Supabase y devuelven `{ error }` en español). `saveScore` no cambia.
8. Editar `app/iniciar-sesion/page.tsx`: renombrar el campo "Usuario" del tab de login a "Correo electrónico" (`type="email"`); `submit` async que llama `signIn(email, pass)` o `signUp(email, pass, user)` según el tab, deshabilita el botón mostrando "ENTRANDO…"/"CREANDO…" mientras corre, y en error muestra `<div className="field" role="alert" style={{ color: "var(--magenta, #ff3ea5)" }}>&gt; {error}</div>` sin perder lo escrito; en éxito, `router.push("/")`.
9. Pasada manual con un proyecto Supabase real: crear el proyecto, desactivar "Confirm email", colocar las variables reales, probar crear cuenta (login inmediato), cerrar sesión, iniciar sesión con password incorrecto (ve error), iniciar sesión correcto, recargar `/` y confirmar que la sesión persiste. Confirmar `npm run lint` y `npm run build` sin errores.

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] `@supabase/supabase-js` y `@supabase/ssr` están en `package.json`; la skill `supabase/agent-skills` queda instalada.
- [ ] `.env.example` y `CLAUDE.md` documentan `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- [ ] Crear cuenta con correo + usuario + password válidos crea el usuario en Supabase Auth, deja la sesión iniciada sin paso de confirmación, y redirige a `/`.
- [ ] Iniciar sesión con correo + password correctos redirige a `/` y `components/nav.tsx` muestra el nombre.
- [ ] Iniciar sesión con credenciales inválidas muestra un error en español dentro del formulario, conserva lo escrito y no redirige.
- [ ] El botón de logout en `components/nav.tsx` cierra la sesión real y vuelve al estado sin usuario.
- [ ] Recargar cualquier página tras iniciar sesión conserva la sesión (cookies refrescadas por `proxy.ts`), sin pedir login de nuevo.
- [ ] `app/salon-de-la-fama/page.tsx` y `app/juego/[id]/jugar/client.tsx` funcionan sin cambios de código, mostrando `user.name` derivado de Supabase.
- [ ] `av_scores` en `localStorage` sigue funcionando igual que antes (fuera de alcance de este spec).
- [ ] Ninguna clave de Supabase que no sea `NEXT_PUBLIC_*` llega al cliente; `SUPABASE_DB_PASSWORD` sigue sin usarse.

## Decisions taken and discarded

- **`proxy.ts` en vez de `middleware.ts`**: en Next.js 16 la convención `middleware.js` está deprecada y renombrada a `proxy.js` (`export function proxy` en vez de `export function middleware`); confirmado en `node_modules/next/dist/docs`. Usar `middleware.ts` aquí simplemente no se ejecutaría.
- **`lib/supabase/` en vez de `utils/supabase/`**: la guía oficial de Supabase usa `utils/`, pero este repo ya organiza su lógica compartida en `lib/` (`lib/data.ts`, `lib/session.tsx`, `lib/types.ts`); seguir esa convención evita una carpeta nueva para lo mismo.
- **Login por correo en vez de usuario**: Supabase Auth autentica con email+password. Mantener "usuario" en el tab de login exigiría una tabla `profiles` solo para resolver usuario→correo antes de autenticar; se prefiere pedir el correo directamente y dejar "usuario" únicamente como nombre visible en el registro.
- **`user_metadata.name` en vez de tabla `profiles`**: el nombre visible cabe en los metadatos del usuario de Auth; una tabla nueva no aporta nada mientras el alcance sea solo autenticación.
- **Desactivar "Confirm email"**: es un paso manual de configuración en el dashboard, no código. Se documenta en `CLAUDE.md` en vez de automatizarse porque no hay API pública simple para eso desde el cliente de la app.
- **Botones sociales y "jugar como invitado" sin tocar**: agregar OAuth real es una decisión de proveedor + configuración de callback URLs que no aporta a "login real con Supabase" y merece su propio spec.
- **Scores y catálogo fuera de alcance**: `saveScore` y `lib/data.ts` no dependen de que el usuario sea real; migrarlos es un cambio de datos, no de autenticación, y se hace por separado.
- **`getUser()` en vez de `getSession()` dentro del proxy**: `getSession()` confía en la cookie sin verificarla contra el servidor de Supabase; `getUser()` sí revalida, que es la recomendación oficial para el código que corre en el proxy/middleware.

## Identified risks

- **Paso manual olvidado**: si "Confirm email" queda activo, el signup no deja logueado y el criterio de aceptación correspondiente falla de forma visible — la pasada manual (paso 9) lo cubre explícitamente.
- **Valores dummy no autentican nada**: hasta que el usuario coloque la URL y la publishable key reales del proyecto, todo intento de login falla de forma controlada (mismo patrón que `RESEND_API_KEY` dummy en SPEC 03).
- **`proxy.ts` corre en cada request por defecto**: sin el `matcher` correcto, se ejecutaría también sobre assets estáticos. Mitigado con un matcher que excluye `_next/static`, `_next/image`, favicon y extensiones de imagen comunes.
