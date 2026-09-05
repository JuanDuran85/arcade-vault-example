"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession } from "@/lib/session";
import { GAMES } from "@/lib/data";

export default function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState("");
  const { saveScore } = useSession();
  const [score, setScore] = useState(0);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [initials, setInitials] = useState("");
  const [saved, setSaved] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    params.then(p => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!paused && !gameOver) {
      timerRef.current = setInterval(() => {
        setScore(s => s + Math.floor(Math.random() * 10) + 5);
      }, 220);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, gameOver]);

  const handleEnd = () => {
    setGameOver(true);
  };

  const handleRestart = () => {
    setScore(0);
    setPaused(false);
    setGameOver(false);
    setSaved(false);
    setInitials("");
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (initials.trim().length === 0) return;

    saveScore({
      game: id,
      score,
      name: initials.toUpperCase().slice(0, 3),
      at: Date.now(),
    });
    setSaved(true);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div className="hud-stat lives">
          <div className="l">VIDAS</div>
          <div className="v">❤❤❤</div>
        </div>
        <div className="hud-stat score">
          <div className="l">PUNTUACIÓN</div>
          <div className="v">{score.toLocaleString("es-ES")}</div>
        </div>
        <div className="hud-stat level">
          <div className="l">NIVEL</div>
          <div className="v">01</div>
        </div>
        <div className="hud-actions">
          <button className="btn ghost" onClick={() => setPaused(!paused)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn ghost" onClick={handleEnd}>FIN</button>
          <button className="btn ghost" onClick={handleRestart}>REINICIAR</button>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <div className="game-arena">
            <div className="grid-floor"></div>
            <div className="player-ship"></div>
            <div className="enemy e1"></div>
            <div className="enemy e2"></div>
            <div className="enemy e3"></div>
          </div>
          {paused && !gameOver && (
            <div className="crt-content" style={{ background: "rgba(0,0,0,0.6)", inset: 0, zIndex: 10 }}>
              <div className="pixel neon-cyan" style={{ fontSize: 24 }}>EN PAUSA</div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <div className="led">SISTEMA ACTIVO</div>
          <div className="led">Carga de neón: 98%</div>
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: 24 }}>
        <Link href={`/juego/${id}`} className="btn ghost">SALIR AL VAULT</Link>
      </div>

      {gameOver && (
        <div className="modal-bd">
          <div className="modal">
            <h2>GAME OVER</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>

            {!saved ? (
              <form onSubmit={handleSave}>
                <div className="input-row">
                  <input
                    maxLength={3}
                    value={initials}
                    onChange={e => setInitials(e.target.value)}
                    placeholder="ABC"
                    autoFocus
                  />
                  <button className="btn magenta" type="submit">GUARDAR PUNTUACIÓN</button>
                </div>
              </form>
            ) : (
              <div className="toast-saved">PUNTUACIÓN GUARDADA CON ÉXITO</div>
            )}

            <div className="modal actions" style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '18px' }}>
              <button className="btn ghost" onClick={handleRestart}>JUGAR DE NUEVO</button>
              <Link href={`/juego/${id}`} className="btn ghost">VOLVER</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
