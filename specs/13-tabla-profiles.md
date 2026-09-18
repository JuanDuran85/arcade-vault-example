# SPEC 13 — Tabla `profiles`

> **Status:** Implementado
> **Depends on:** SPEC 04
> **Date:** 2026-09-17
> **Objective:** Crear `public.profiles` (name, avatar_url), poblada automáticamente por un trigger en `auth.users`, para tener un lugar donde guardar la foto de perfil que traerá el login OAuth de SPEC 14.

---

## Por qué existe este spec

SPEC 04 dejó `name` viviendo en `user_metadata` porque no había necesidad de una tabla propia. SPEC 14 (OAuth) va a traer una foto de perfil de Google/GitHub que no tiene un lugar natural en `user_metadata` sin reescribir `toSessionUser`. Este spec crea esa tabla primero, sin tocar cómo se resuelve `name` hoy, para que SPEC 14 solo tenga que leer una columna que ya existe.

## Scope

**In:**

- Migración `supabase/migrations/20260917000000_add_profiles_table.sql`: tabla `public.profiles` (`id uuid` PK, FK a `auth.users(id)` on delete cascade; `name text`; `avatar_url text` nullable; `created_at timestamptz default now()`).
- Función `handle_new_user()` (`SECURITY DEFINER`) + trigger `on_auth_user_created` (`AFTER INSERT ON auth.users`) que inserta la fila en `profiles`, tomando `name` de `raw_user_meta_data->>'name'` (fallback: el email) y `avatar_url` de `raw_user_meta_data->>'avatar_url'` (null si no viene).
- RLS: `select` abierto a cualquiera (autenticado o no, igual que `games`/`scores`); `update` solo permitido donde `auth.uid() = id`; sin política de `insert` para roles de la app (la fila nace solo por el trigger).
- `lib/types.ts`: `SessionUser` gana `avatarUrl?: string | null`.
- `lib/session.tsx`: al resolver el usuario (login inicial y `onAuthStateChange`), además de `toSessionUser` hace un `select avatar_url from profiles where id = u.id` y lo agrega al objeto.
- Nota en `CLAUDE.md` sobre la tabla nueva y el trigger.

**Out of scope (para specs futuros):**

- De dónde sale `name` no cambia: sigue en `user_metadata`, `profiles.name` existe pero no se lee todavía en ningún lado.
- Pantalla para editar perfil (subir avatar propio, cambiar nombre).
- Bucket de Storage para avatares — `avatar_url` solo guarda la URL externa que ya trae el provider OAuth.
- Backfill de `avatar_url` para cuentas creadas antes de este spec (SPEC 04) — quedan con `avatar_url` null hasta que vuelvan a loguearse con OAuth (SPEC 14).

## Data model

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

```ts
// lib/types.ts
export interface SessionUser {
  name: string;
  avatarUrl?: string | null;
}
```

## Implementation plan

1. Escribir y aplicar la migración (tabla + RLS + función + trigger) con la MCP `apply_migration`. Nada de código de la app cambió todavía; `npm run build` sigue pasando.
2. `lib/types.ts`: agregar `avatarUrl?: string | null` a `SessionUser`.
3. `lib/session.tsx`: extraer la resolución de usuario a una función async que, tras `toSessionUser(u)`, hace `const { data } = await supabase.from("profiles").select("avatar_url").eq("id", u.id).single()` y devuelve `{ ...base, avatarUrl: data?.avatar_url ?? null }`; usarla tanto en el `getUser()` inicial como en `onAuthStateChange`.
4. Pasada manual: crear una cuenta por email, confirmar en Supabase Studio que apareció una fila en `profiles` con `avatar_url` null; recargar la app y confirmar que `nav.tsx` sigue mostrando el nombre igual que antes. `npm run lint` y `npm run build`.

## Acceptance criteria

- [X] La migración queda aplicada; `public.profiles` existe con columnas `id`, `name`, `avatar_url`, `created_at`.
- [X] Crear una cuenta por email crea automáticamente su fila en `profiles`, sin código nuevo en `signUp`.
- [X] RLS: cualquiera puede leer cualquier fila de `profiles`; un usuario no puede actualizar la fila de otro (verificable con `execute_sql` simulando dos usuarios, o con el advisor de RLS).
- [X] `SessionUser` expone `avatarUrl` (null cuando no hay foto) sin cambiar `components/nav.tsx`, `app/salon-de-la-fama/page.tsx` ni `app/juego/[id]/jugar/client.tsx`.
- [X] `npm run build` y `npm run lint` terminan sin errores.

## Decisions taken and discarded

- **Trigger de Postgres en vez de insert desde la app**: funciona igual para signup por email (SPEC 04) y por OAuth (SPEC 14) sin duplicar la lógica en `signUp`/`signInWithOAuth`.
- **`SECURITY DEFINER` en la función**: el trigger corre antes de que el usuario recién creado tenga permisos propios; sin esto, el insert a `profiles` fallaría por RLS.
- **`name` no se migra a `profiles`**: ya vive en `user_metadata` y todo el código lo lee de ahí (SPEC 04); mover la fuente de verdad no aporta nada a este spec y arriesga romper `toSessionUser`.
- **Sin bucket de Storage**: el avatar es una URL externa del provider OAuth, no un archivo que la app almacene.

## Identified risks

| Riesgo                                                                              | Mitigación                                                                                                                      |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| El trigger falla silenciosamente si `raw_user_meta_data` tiene una forma inesperada | `coalesce(..., new.email)` cubre el caso sin `name`; `avatar_url` simplemente queda null si la clave no existe, no lanza error. |
| RLS mal configurada deja escribir el `avatar_url` de otro usuario                   | Criterio de aceptación explícito lo verifica antes de dar el spec por cerrado.                                                  |
