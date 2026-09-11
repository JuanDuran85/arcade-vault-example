import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import type { Game } from "./types";

// `game_stats` es `games` + los agregados `best`/`plays` calculados en la consulta.
// Los errores se propagan a propósito: sin fallback a datos locales, un catálogo
// obsoleto sería peor que un error visible.
//
// cache(): /juego/[id] llama getGame() desde layout.tsx (sidebar) y page.tsx
// (el juego) en el mismo request — sin esto son dos round trips a Supabase
// por la misma fila. Depende de que createClient() (lib/supabase/server.ts)
// también esté cacheado, para que ambas llamadas compartan el mismo cliente.

export const getGames = cache(async function getGames(
  supabase: SupabaseClient,
): Promise<Game[]> {
  const { data, error } = await supabase
    .from("game_stats")
    .select("*")
    .order("title");

  if (error) throw new Error(`No se pudo cargar el catálogo: ${error.message}`);
  return data as Game[];
});

export const getGame = cache(async function getGame(
  supabase: SupabaseClient,
  id: string,
): Promise<Game | null> {
  const { data, error } = await supabase
    .from("game_stats")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`No se pudo cargar el juego: ${error.message}`);
  return data as Game | null;
});
