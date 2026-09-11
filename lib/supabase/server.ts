import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

// cache(): one client per request, not one per call. /juego/[id] renders
// layout.tsx and page.tsx in the same request and each used to call
// createClient() + getGame() separately — two round trips for one row.
// React dedupes by argument identity, so the client must be the shared
// object for getGame()'s own cache() (lib/catalog.ts) to collapse into one.
export const createClient = cache(async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — ignored because `proxy.ts`
            // refreshes the session cookies on every request instead.
          }
        },
      },
    },
  );
});
