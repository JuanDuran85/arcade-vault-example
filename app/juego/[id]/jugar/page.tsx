import React from "react";
import { getGame } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import GamePlayerClient from "./client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GamePlayerPage({ params }: PageProps) {
  const { id } = await params;
  const game = await getGame(await createClient(), id);

  if (!game) {
    notFound();
  }

  return <GamePlayerClient game={game} id={id} />;
}
