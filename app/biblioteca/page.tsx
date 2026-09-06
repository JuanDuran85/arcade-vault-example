import { getGames } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import LibraryClient from "./client";

export default async function LibraryPage() {
  const games = await getGames(await createClient());
  return <LibraryClient games={games} />;
}
