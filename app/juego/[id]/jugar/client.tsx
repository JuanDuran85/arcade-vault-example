"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { saveScore } from "@/lib/scores";
import { createClient } from "@/lib/supabase/client";
import type { Game } from "@/lib/types";
import {
  GAMES,
  type GameHandle,
  type GameState,
  type TouchButton,
} from "@/lib/games/registry";
import { SKINS, type Skin, type SkinId } from "@/lib/games/skins";

// Todos los juegos arrancan sin puntos; el juego notifica sus vidas reales en
// el primer notify(), síncrono dentro de start().
const INITIAL_STATE: GameState = { score: 0, lives: 0 };

function GameCanvas({
  start,
  paused,
  muted,
  skinId,
  onState,
  onGameOver,
  handleRef,
}: {
  start: (typeof GAMES)[string]["start"];
  paused: boolean;
  muted: boolean;
  skinId: SkinId;
  onState: (s: GameState) => void;
  onGameOver: (finalScore: number) => void;
  handleRef: React.RefObject<GameHandle | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // El juego guarda esta misma referencia; cambiar de skin muta sus campos
  // en vez de reemplazar el objeto, así el juego en curso no se reinicia.
  const skinRef = useRef<Skin>({ ...SKINS[skinId] });

  // Los callbacks llegan memoizados del padre: el juego no se reinicia en
  // cada render. `paused` va en su propio efecto por lo mismo.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = start(canvas, { onState, onGameOver }, skinRef.current);
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

  // ponytail: mutación in-place para no reiniciar la partida; setSkin() en
  // GameHandle si algún juego necesita reaccionar al cambio
  useEffect(() => {
    Object.assign(skinRef.current, SKINS[skinId]);
  }, [skinId]);

  return <canvas ref={canvasRef} className="game-canvas" />;
}

// Space es la única tecla cuyo `key` no coincide con su `code`.
function keyFromCode(code: string): string {
  return code === "Space" ? " " : code;
}

// Botones táctiles: despachan KeyboardEvent sintéticos a `window`, donde los
// cuatro juegos ya escuchan keydown/keyup. Mantener pulsado = tecla mantenida,
// así que el disparo continuo mientras se mantiene presionado ya sale gratis
// del lado del juego (asteroids.ts lee `keys["Space"]`, no un flanco).
// Flechas SVG de references/gamepad-assets/gamepad.html, por code.
const ARROWS: Record<string, { cls: string; path: string }> = {
  ArrowUp: { cls: "up", path: "M12 4 L20 16 L4 16 Z" },
  ArrowRight: { cls: "right", path: "M8 4 L20 12 L8 20 Z" },
  ArrowDown: { cls: "down", path: "M4 8 L20 8 L12 20 Z" },
  ArrowLeft: { cls: "left", path: "M16 4 L16 20 L4 12 Z" },
};

function TouchPad({ buttons }: { buttons: TouchButton[] }) {
  const send = (type: "keydown" | "keyup", code: string) => {
    window.dispatchEvent(
      new KeyboardEvent(type, { key: keyFromCode(code), code }),
    );
  };

  const handlers = (code: string) => ({
    onPointerDown: () => send("keydown", code),
    onPointerUp: () => send("keyup", code),
    onPointerCancel: () => send("keyup", code),
    onPointerLeave: () => send("keyup", code),
  });

  const renderArrow = (b: TouchButton) => {
    const dir = ARROWS[b.code];
    return (
      <button
        key={b.code}
        type="button"
        className={`dp dp-${dir.cls}`}
        aria-label={b.label}
        data-code={b.code}
        {...handlers(b.code)}
      >
        <svg className="dp-arrow" viewBox="0 0 24 24" aria-hidden>
          <path d={dir.path} fill="currentColor" />
        </svg>
      </button>
    );
  };

  // El botón de acción (A) lleva su `hint` encima: "Disparar", "Soltar"…
  const renderAction = (b: TouchButton) => (
    <div key={b.code} className="touch-action-wrap">
      {b.hint && <span className="touch-hint">{b.hint}</span>}
      <button
        type="button"
        className="ab a"
        aria-label={b.hint ?? b.label}
        data-code={b.code}
        {...handlers(b.code)}
      >
        <span className="ab-ring" />
        <span className="ab-letter">{b.label}</span>
      </button>
    </div>
  );

  // Cruz con hub solo si el juego declara las cuatro flechas; si no (bloques),
  // las flechas van en fila con el mismo estilo .dp.
  const dpad = buttons.filter((b) => b.code in ARROWS);
  const actions = buttons.filter((b) => !(b.code in ARROWS));
  const cross = dpad.length === 4;

  return (
    <div className="touch-pad gp">
      {dpad.length > 0 && (
        <div className={cross ? "gp-dpad" : "gp-dpad gp-dpad-row"}>
          {dpad.map(renderArrow)}
          {cross && (
            <div className="dp-hub" aria-hidden>
              <span className="dp-hub-gem" />
            </div>
          )}
        </div>
      )}
      {actions.length > 0 && (
        <div className="gp-actions">{actions.map(renderAction)}</div>
      )}
    </div>
  );
}

const SKIN_ORDER: SkinId[] = ["clasico", "neon", "retro"];
const SKIN_LABELS: Record<SkinId, string> = {
  clasico: "CLÁSICO",
  neon: "NEÓN",
  retro: "RETRO",
};

export default function GamePlayerClient({
  game,
  id,
}: {
  game: Game;
  id: string;
}) {
  const entry = GAMES[id];
  const router = useRouter();
  const handleRef = useRef<GameHandle | null>(null);
  const [runId, setRunId] = useState(0);
  const { user } = useSession();
  const [state, setState] = useState<GameState>(INITIAL_STATE);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(
    () =>
      typeof window !== "undefined" && localStorage.getItem("av_muted") === "1",
  );
  const [skinId, setSkinId] = useState<SkinId>(
    () =>
      (typeof window !== "undefined" &&
        (localStorage.getItem("av_skin") as SkinId | null)) ||
      "clasico",
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

  const selectSkin = (next: SkinId) => {
    setSkinId(next);
    localStorage.setItem("av_skin", next);
  };

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

  // Botones compartidos entre la barra superior (mouse) y la barra bajo el
  // gamepad (dedo, @media pointer:coarse) — mismo elemento en dos posiciones,
  // sin duplicar el JSX de cada uno.
  const pauseBtn = (
    <button className="btn yellow" onClick={togglePause}>
      {paused ? "REANUDAR" : "PAUSA"}
    </button>
  );
  const soundBtn = entry.sound && (
    <button
      className="btn"
      onClick={toggleMuted}
      aria-pressed={muted}
      suppressHydrationWarning
    >
      {muted ? "SONIDO" : "SILENCIO"}
    </button>
  );
  const skinSelect = entry.skins && (
    <select
      className="btn"
      value={skinId}
      onChange={(e) => selectSkin(e.target.value as SkinId)}
      aria-label="Skin"
      suppressHydrationWarning
    >
      {SKIN_ORDER.map((s) => (
        <option key={s} value={s}>
          {SKIN_LABELS[s]}
        </option>
      ))}
    </select>
  );
  const finBtn = (
    <button className="btn magenta" onClick={endGame}>
      FIN
    </button>
  );
  const salirLink = (
    <Link href={`/juego/${id}`} className="btn ghost">
      SALIR
    </Link>
  );

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
          {pauseBtn}
          {soundBtn}
          {skinSelect}
          {finBtn}
          {salirLink}
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <GameCanvas
            key={runId}
            start={entry.start}
            paused={paused}
            muted={muted}
            skinId={skinId}
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

      <TouchPad buttons={entry.touch} />

      {/* Misma barra que .hud-actions + REGRESAR; solo visible bajo el
          gamepad con @media (pointer: coarse), que a su vez oculta la de
          arriba — así el dedo nunca ve las dos. */}
      <div className="touch-controls mono">
        {pauseBtn}
        {soundBtn}
        {skinSelect}
        <button className="btn ghost" onClick={() => router.back()}>
          REGRESAR
        </button>
        {finBtn}
        {salirLink}
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
