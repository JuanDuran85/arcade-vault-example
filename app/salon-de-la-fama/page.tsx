import { getGames } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import HallOfFameClient from "./client";

export default async function HallOfFamePage() {
  const games = await getGames(await createClient());
  return <HallOfFameClient games={games} />;
}
