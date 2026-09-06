import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScoreRow } from "./types";

// `games(title)` es un recurso embebido de PostgREST, resuelto por la FK
// scores_game_id_fkey. Al ser muchos-a-uno devuelve un objeto, no un array
// (verificado contra la API); sin tipos generados, supabase-js lo infiere como
// array y por eso hace falta el doble cast de abajo.
type ScoreQueryRow = {
  score: number;
  player_name: string;
  created_at: string;
  games: { title: string } | null;
};

/** Sin `gameId` devuelve el ranking global. Nunca lanza: un leaderboard caído
 *  no debe romper la página del juego. */
export async function topScores(
  supabase: SupabaseClient,
  { gameId, limit = 10 }: { gameId?: string; limit?: number },
): Promise<ScoreRow[]> {
  let query = supabase
    .from("scores")
    .select("score, player_name, created_at, games(title)")
    .order("score", { ascending: false })
    // Desempate estable: a igual puntuación, primero quien la logró antes.
    .order("created_at", { ascending: true })
    .limit(limit);

  if (gameId) query = query.eq("game_id", gameId);

  const { data, error } = await query;

  if (error) {
    console.error("topScores:", error.message);
    return [];
  }

  return (data as unknown as ScoreQueryRow[]).map((row, i) => ({
    rank: i + 1,
    name: row.player_name,
    score: row.score,
    // Locale fija: la del navegador desajustaría la hidratación.
    // 2-digit para que sea dd/mm/aaaa, no d/m/aaaa.
    date: new Date(row.created_at).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    gameTitle: row.games?.title ?? "",
  }));
}

/** `user_id` no se envía nunca: lo pone el default `auth.uid()` de la columna. */
export async function saveScore(
  supabase: SupabaseClient,
  { gameId, name, score }: { gameId: string; name: string; score: number },
): Promise<{ error: string | null }> {
  const playerName = name.trim().toUpperCase().slice(0, 12);

  const { error } = await supabase
    .from("scores")
    .insert({ game_id: gameId, player_name: playerName, score });

  if (error) return { error: error.message };

  localStorage.setItem("av_player_name", playerName);
  return { error: null };
}
