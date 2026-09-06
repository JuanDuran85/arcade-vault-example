"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { topScores } from "@/lib/scores";
import { useSession } from "@/lib/session";
import type { Game, ScoreRow } from "@/lib/types";

type Podium = "gold" | "silver" | "bronze";

function PodiumSlot({ row, kind }: { row: ScoreRow; kind: Podium }) {
  const isGold = kind === "gold";
  const rank = kind === "gold" ? "01" : kind === "silver" ? "02" : "03";

  return (
    <div className={`podium-slot ${kind}`}>
      {isGold && (
        <div
          className="pixel"
          style={{
            fontSize: 9,
            color: "var(--gold)",
            letterSpacing: "0.18em",
          }}
        >
          CAMPEÓN
        </div>
      )}
      <div
        className="rank-num"
        style={isGold ? { fontSize: 36, marginTop: 4 } : undefined}
      >
        {rank}
      </div>
      <div className="name">{row.name}</div>
      <div className="score" style={isGold ? { fontSize: 20 } : undefined}>
        {row.score.toLocaleString("es-ES")}
      </div>
      <div className="date">{row.date}</div>
    </div>
  );
}

export default function HallOfFameClient({ games }: { games: Game[] }) {
  const [tab, setTab] = useState("global");
  // Se guarda junto al tab que lo produjo: mientras no coincidan, estamos cargando.
  // Evita un setState síncrono dentro del efecto solo para marcar "cargando".
  const [loaded, setLoaded] = useState<{ tab: string; rows: ScoreRow[] } | null>(
    null,
  );
  const { user } = useSession();

  useEffect(() => {
    let cancelled = false;

    topScores(createClient(), {
      gameId: tab === "global" ? undefined : tab,
      limit: 12,
    }).then((rows) => {
      if (!cancelled) setLoaded({ tab, rows });
    });

    return () => {
      cancelled = true;
    };
  }, [tab]);

  const loading = loaded?.tab !== tab;
  const rows = loading ? [] : loaded!.rows;

  const isGlobal = tab === "global";
  // `player_name` se guarda recortado y en mayúsculas: normalizamos igual para comparar.
  const mine = user ? user.name.trim().toUpperCase().slice(0, 12) : null;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        <button
          className={`chip ${isGlobal ? "active" : ""}`}
          onClick={() => setTab("global")}
        >
          GLOBAL
        </button>
        {games.map((g) => (
          <button
            key={g.id}
            className={`chip ${tab === g.id ? "active" : ""}`}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {rows.length > 0 && (
        <div className="podium">
          {rows[1] && <PodiumSlot row={rows[1]} kind="silver" />}
          {rows[0] && <PodiumSlot row={rows[0]} kind="gold" />}
          {rows[2] && <PodiumSlot row={rows[2]} kind="bronze" />}
        </div>
      )}

      <div className={`hall-table${isGlobal ? " global" : ""}`}>
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          {isGlobal && <div>JUEGO</div>}
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>

        {rows.map((r, i) => (
          <div
            key={r.name + i}
            className={`tr ${
              i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : ""
            }${r.name === mine ? " you" : ""}`}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
            <div className="pl">{r.name}</div>
            {isGlobal && <div className="pl">{r.gameTitle}</div>}
            <div className="sc">{r.score.toLocaleString("es-ES")}</div>
            <div className="dt">{r.date}</div>
          </div>
        ))}

        {rows.length === 0 && (
          <div className="lb-empty">
            {loading ? "CARGANDO…" : "SÉ EL PRIMERO EN ENTRAR AL SALÓN DE LA FAMA"}
          </div>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
