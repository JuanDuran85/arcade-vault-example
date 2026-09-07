// Alta de un juego nuevo: un módulo en lib/games/ y una entrada en GAMES.
import { startAsteroids } from "./asteroids";
import { startBloques } from "./bloques";
import { startCaida } from "./caida";

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

interface GameEntry {
  start(canvas: HTMLCanvasElement, callbacks: GameCallbacks): GameHandle;
  controls: string; // fila de controles bajo el marco CRT
  sound?: boolean; // pinta el botón de silencio; hoy solo bloques
}

export const GAMES: Record<string, GameEntry> = {
  rocas: {
    start: startAsteroids,
    controls: "← → ROTAR · ↑ PROPULSAR · ESPACIO DISPARAR",
  },
  caida: {
    start: startCaida,
    controls: "← → MOVER · ↑ ROTAR · ↓ BAJAR · ESPACIO SOLTAR",
  },
  bloques: {
    start: startBloques,
    controls: "← → MOVER PALETA · O MUEVE EL RATÓN",
    sound: true,
  },
};
