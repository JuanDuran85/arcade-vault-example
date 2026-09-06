import type { SupabaseClient } from "@supabase/supabase-js";
import type { Game } from "./types";

// `game_stats` es `games` + los agregados `best`/`plays` calculados en la consulta.
// Los errores se propagan a propósito: sin fallback a datos locales, un catálogo
// obsoleto sería peor que un error visible.

export async function getGames(supabase: SupabaseClient): Promise<Game[]> {
  const { data, error } = await supabase
    .from("game_stats")
    .select("*")
    .order("title");

  if (error) throw new Error(`No se pudo cargar el catálogo: ${error.message}`);
  return data as Game[];
}

export async function getGame(
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
}
