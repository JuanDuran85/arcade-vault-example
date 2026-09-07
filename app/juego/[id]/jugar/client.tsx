"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSession } from "@/lib/session";
import { saveScore } from "@/lib/scores";
import { createClient } from "@/lib/supabase/client";
import type { Game } from "@/lib/types";
import { GAMES, type GameHandle, type GameState } from "@/lib/games/registry";

// Todos los juegos arrancan sin puntos; el juego notifica sus vidas reales en
// el primer notify(), síncrono dentro de start().
const INITIAL_STATE: GameState = { score: 0, lives: 0 };

function GameCanvas({
  start,
  paused,
  muted,
  onState,
  onGameOver,
  handleRef,
}: {
  start: (typeof GAMES)[string]["start"];
  paused: boolean;
  muted: boolean;
  onState: (s: GameState) => void;
  onGameOver: (finalScore: number) => void;
  handleRef: React.RefObject<GameHandle | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Los callbacks llegan memoizados del padre: el juego no se reinicia en
  // cada render. `paused` va en su propio efecto por lo mismo.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = start(canvas, { onState, onGameOver });
    handleRef.current = handle;
    return () => {
      handle.stop();
      handleRef.current = null;
    };
  }, [start, onState, onGameOver, handleRef]);

  useEffect(() => {
    handleRef.current?.setPaused(paused);
  }, [paused, handleRef]);

  // Propio efecto por lo mismo que paused. El ?. cubre a los juegos sin sonido.
  useEffect(() => {
    handleRef.current?.setMuted?.(muted);
  }, [muted, handleRef]);

  return <canvas ref={canvasRef} className="game-canvas" />;
}

export default function GamePlayerClient({
  game,
  id,
}: {
  game: Game;
  id: string;
}) {
  const entry = GAMES[id];
  const handleRef = useRef<GameHandle | null>(null);
  const [runId, setRunId] = useState(0);
  const { user } = useSession();
  const [state, setState] = useState<GameState>(INITIAL_STATE);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("av_muted") === "1",
  );
  const [over, setOver] = useState(false);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El nombre de sesión se lee por ref: meterlo en las dependencias de
  // onGameState remontaría el canvas y reiniciaría la partida.
  const userNameRef = useRef<string | null>(null);
  useEffect(() => {
    userNameRef.current = user?.name ?? null;
  }, [user]);

  // Se resuelve al abrir el modal, no al montar: localStorage no existe en el
  // render del servidor. El updater nunca pisa lo que el jugador ya escribió.
  const recallName = useCallback(() => {
    setName(
      (current) =>
        current ||
        localStorage.getItem("av_player_name") ||
        userNameRef.current ||
        "",
    );
  }, []);

  const toggleMuted = () =>
    setMuted((m) => {
      const next = !m;
      localStorage.setItem("av_muted", next ? "1" : "0");
      return next;
    });

  const onGameState = useCallback((s: GameState) => setState(s), []);

  const onGameOver = useCallback(
    (finalScore: number) => {
      setState((s) => ({ ...s, score: finalScore }));
      setOver(true);
      recallName();
    },
    [recallName],
  );

  const togglePause = () => setPaused((p) => !p);

  // El modal lo abre onGameOver, por el que el juego acaba pasando.
  const endGame = () => handleRef.current?.endGame();

  const restart = () => {
    setState(INITIAL_STATE);
    setPaused(false);
    setOver(false);
    setSaved(false);
    setError(null);
    setRunId((r) => r + 1); // remonta el canvas → partida nueva
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const result = await saveScore(createClient(), {
      gameId: id,
      name,
      score: state.score,
    });

    setSaving(false);
    if (result.error) setError(result.error);
    else setSaved(true);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name || "INVITADO"}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{state.score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(state.lives).trim() || "—"}</div>
          </div>
          {state.level !== undefined && (
            <div className="hud-stat level">
              <div className="l">Nivel</div>
              <div className="v">{String(state.level).padStart(2, "0")}</div>
            </div>
          )}
          {state.lines !== undefined && (
            <div className="hud-stat">
              <div className="l">Líneas</div>
              <div className="v">{state.lines.toLocaleString("es-ES")}</div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          {entry.sound && (
            <button
              className="btn"
              onClick={toggleMuted}
              aria-pressed={muted}
              // El servidor no tiene localStorage y siempre pinta SILENCIO; si
              // el jugador lo tenía silenciado, el cliente pinta SONIDO. Es la
              // única diferencia y es intencional.
              suppressHydrationWarning
            >
              {muted ? "SONIDO" : "SILENCIO"}
            </button>
          )}
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <Link href={`/juego/${id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <GameCanvas
            key={runId}
            start={entry.start}
            paused={paused}
            muted={muted}
            onState={onGameState}
            onGameOver={onGameOver}
            handleRef={handleRef}
          />
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
        <div className="game-controls mono">{entry.controls}</div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2 style={{ textAlign: "center" }}>FIN DEL JUEGO</h2>
            <div className="final-label" style={{ textAlign: "center" }}>
              PUNTUACIÓN FINAL
            </div>
            <div className="final" style={{ textAlign: "center" }}>
              {state.score.toLocaleString("es-ES")}
            </div>
            {!saved ? (
              <>
                <div className="input-row">
                  <input
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value.toUpperCase().slice(0, 12))
                    }
                    placeholder="TUS INICIALES"
                  />
                  <button
                    className="btn yellow"
                    onClick={handleSave}
                    disabled={saving || !name.trim()}
                  >
                    {saving ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                  </button>
                </div>
                {error && (
                  <div
                    className="field"
                    role="alert"
                    style={{ color: "var(--magenta, #ff3ea5)" }}
                  >
                    &gt; {error}
                  </div>
                )}
              </>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
