import React from "react";
import Link from "next/link";
import { GAMES } from "@/lib/data";
import GamePlayerClient from "./client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GamePlayerPage({ params }: PageProps) {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);

  if (!game) {
    return (
      <div className="fade-in" style={{ textAlign: "center", padding: 80 }}>
        <h2 className="neon-magenta">JUEGO NO ENCONTRADO</h2>
        <Link href="/" className="btn ghost" style={{ marginTop: 20 }}>
          VOLVER AL VAULT
        </Link>
      </div>
    );
  }

  return <GamePlayerClient game={game} id={id} />;
}
