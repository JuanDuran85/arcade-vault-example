import { getGames } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import HomeClient from "./client";

export default async function Home() {
  const games = await getGames(await createClient());
  return <HomeClient games={games} />;
}
