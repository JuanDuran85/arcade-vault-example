// Alta de un juego nuevo: un módulo en lib/games/ y una entrada en GAMES.
import { startAsteroids } from "./asteroids";
import { startBloques } from "./bloques";
import { startCaida } from "./caida";
import { startSnake } from "./snake";
import type { Skin } from "./skins";

export interface GameState {
  score: number;
  lives: number; // todos los juegos tienen vidas; caida siempre reporta 1
  level?: number; // rocas, caida
  lines?: number; // caida
}

export interface GameCallbacks {
  onState: (state: GameState) => void;
  onGameOver: (finalScore: number) => void; // se emite una sola vez por partida
}

export interface GameHandle {
  stop(): void; // cancela el rAF y quita los listeners de teclado
  setPaused(paused: boolean): void;
  endGame(): void; // fuerza el fin de partida; acaba emitiendo onGameOver
  setMuted?(muted: boolean): void; // solo los juegos con sonido
}

export interface TouchButton {
  label: string; // texto del botón, en español
  code: KeyboardEvent["code"]; // "ArrowLeft", "Space"…; `key` se deriva: "Space" → " ", el resto key === code
  hint?: string; // texto pequeño encima del botón, ej. "Disparar" sobre el botón "A"
}

interface GameEntry {
  start(
    canvas: HTMLCanvasElement,
    callbacks: GameCallbacks,
    skin?: Skin,
  ): GameHandle;
  controls: string; // fila de controles bajo el marco CRT
  sound?: boolean; // pinta el botón de silencio; hoy solo bloques
  skins?: boolean; // pinta el selector de skin; los juegos ya migrados
  touch: TouchButton[]; // gamepad táctil; obligatorio para que un juego nuevo no lo olvide
}

export const GAMES: Record<string, GameEntry> = {
  rocas: {
    start: startAsteroids,
    controls: "← → ROTAR · ↑ PROPULSAR · ↓ FRENAR · ESPACIO DISPARAR",
    skins: true,
    touch: [
      { label: "←", code: "ArrowLeft" },
      { label: "→", code: "ArrowRight" },
      { label: "↑", code: "ArrowUp" },
      { label: "↓", code: "ArrowDown" },
      { label: "A", code: "Space", hint: "Disparar" },
    ],
  },
  caida: {
    start: startCaida,
    controls: "← → MOVER · ↑ ROTAR · ↓ BAJAR · ESPACIO SOLTAR",
    touch: [
      { label: "←", code: "ArrowLeft" },
      { label: "→", code: "ArrowRight" },
      { label: "↑", code: "ArrowUp" },
      { label: "↓", code: "ArrowDown" },
      { label: "A", code: "Space", hint: "Soltar" },
    ],
  },
  bloques: {
    start: startBloques,
    controls: "← → MOVER PALETA · O MUEVE EL RATÓN",
    sound: true,
    skins: true,
    touch: [
      { label: "←", code: "ArrowLeft" },
      { label: "→", code: "ArrowRight" },
    ],
  },
  snake: {
    start: startSnake,
    controls: "↑ ↓ ← → MOVER · WASD TAMBIÉN",
    skins: true,
    touch: [
      { label: "↑", code: "ArrowUp" },
      { label: "↓", code: "ArrowDown" },
      { label: "←", code: "ArrowLeft" },
      { label: "→", code: "ArrowRight" },
    ],
  },
};
