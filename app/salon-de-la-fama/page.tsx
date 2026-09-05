"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { GAMES, seededScores } from "@/lib/data";
import { useSession } from "@/lib/session";

export default function HallOfFamePage() {
  const [gameId, setGameId] = useState(GAMES[0].id);
  const { user } = useSession();

  const scores = useMemo(() => seededScores(gameId.length, 20), [gameId]);

  const myBestScore = useMemo(() => {
    try {
      const saved = localStorage.getItem("av_scores");
      if (!saved) return null;
      const all: { game: string; score: number; name: string; at: number }[] = JSON.parse(saved);
      const gameScores = all.filter(s => s.game === gameId);
      if (gameScores.length === 0) return null;
      return Math.max(...gameScores.map(s => s.score));
    } catch {
      return null;
    }
  }, [gameId]);

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p>Los maestros del neón y los reyes del pixel</p>
      </div>

      <div className="hall-tabs">
        {GAMES.map(g => (
          <button
            key={g.id}
            className={`chip ${gameId === g.id ? "active" : ""}`}
            onClick={() => setGameId(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      <div className="podium">
        <div className="podium-slot silver">
          <div className="rank-num">2</div>
          <div className="name">{scores[1]?.name}</div>
          <div className="score">{scores[1]?.score.toLocaleString("es-ES")}</div>
          <div className="date">{scores[1]?.date}</div>
        </div>
        <div className="podium-slot gold">
          <div className="rank-num">1</div>
          <div className="name">{scores[0]?.name}</div>
          <div className="score">{scores[0]?.score.toLocaleString("es-ES")}</div>
          <div className="date">{scores[0]?.date}</div>
        </div>
        <div className="podium-slot bronze">
          <div className="rank-num">3</div>
          <div className="name">{scores[2]?.name}</div>
          <div className="score">{scores[2]?.score.toLocaleString("es-ES")}</div>
          <div className="date">{scores[2]?.date}</div>
        </div>
      </div>

      <div className="hall-table">
        <div className="th">
          <div>RG</div>
          <div>PILOTO</div>
          <div>PUNTOS</div>
          <div>FECHA</div>
        </div>
        {user && myBestScore !== null && (
          <div className="tr you-label">TU MEJOR MARCA: {myBestScore.toLocaleString("es-ES")}</div>
        )}
        {scores.map((row, i) => (
          <div key={i} className={`tr ${i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : ""}`}>
            <div className="rk">#{row.rank}</div>
            <div className="pl">{row.name}</div>
            <div className="sc">{row.score.toLocaleString("es-ES")}</div>
            <div className="dt">{row.date}</div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/" className="btn ghost lg">VOLVER A la BIBLIOTECA</Link>
      </div>
    </div>
  );
}
