// Diseñado desde cero para SPEC 10 — no hay game.js de referencia que portar.
// Todo el estado vive dentro de startSnake() para que dos montajes no
// compartan tablero. No se escribe en el DOM ni en localStorage: el overlay,
// los botones y el ranking los pone la plataforma.

import type { GameCallbacks, GameHandle, GameState } from "./registry";

const CELL = 20;
const COLS = 40; // 800 / 20
const ROWS = 40; // 800 / 20 — tablero cuadrado
const W = COLS * CELL; // 800
const H = ROWS * CELL; // 800

const BASE_INTERVAL = 150; // ms; baja 10 por nivel
const MIN_INTERVAL = 60; // piso
const POINTS_PER_FRUIT = 10;
const POINTS_PER_LEVEL = 50; // cada 50 puntos (5 frutas) sube el nivel

// Atlas de frutas, portado de references/source-assets/snake-assets/sprites.js
// (fila pixel-art, y: 136). Coordenadas verificadas por análisis de píxeles en
// el archivo original — se copian tal cual, sin recalcular.
const FRUITS: { x: number; y: number; w: number; h: number }[] = [
  { x: 34, y: 136, w: 110, h: 160 }, // banana
  { x: 186, y: 136, w: 150, h: 160 }, // orange
  { x: 378, y: 136, w: 110, h: 160 }, // grape
  { x: 540, y: 136, w: 130, h: 160 }, // garlic
  { x: 712, y: 136, w: 130, h: 160 }, // eggplant
  { x: 894, y: 136, w: 110, h: 160 }, // strawberry
  { x: 1066, y: 136, w: 110, h: 160 }, // cherry
  { x: 1228, y: 136, w: 130, h: 160 }, // carrot
  { x: 1400, y: 136, w: 130, h: 160 }, // mushroom
  { x: 1582, y: 136, w: 110, h: 160 }, // broccoli
  { x: 1734, y: 136, w: 150, h: 160 }, // watermelon
  { x: 1906, y: 136, w: 150, h: 160 }, // pepper
  { x: 2068, y: 136, w: 170, h: 160 }, // kiwi
  { x: 2250, y: 136, w: 140, h: 160 }, // lemon
  { x: 2432, y: 136, w: 130, h: 160 }, // peach
  { x: 2604, y: 136, w: 130, h: 160 }, // peanut
  { x: 2786, y: 136, w: 110, h: 160 }, // apple
  { x: 2948, y: 136, w: 130, h: 160 }, // tomato
  { x: 3110, y: 136, w: 150, h: 160 }, // berries
  { x: 3302, y: 136, w: 110, h: 160 }, // grapes2
  { x: 3454, y: 136, w: 150, h: 160 }, // pineapple
  { x: 3637, y: 136, w: 130, h: 160 }, // melon
];

interface Cell {
  x: number;
  y: number;
}

export function startSnake(
  canvas: HTMLCanvasElement,
  { onState, onGameOver }: GameCallbacks,
): GameHandle {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Cabeza en el índice 0, 3 segmentos iniciales, centrada y mirando a la derecha.
  const startX = Math.floor(COLS / 2);
  const startY = Math.floor(ROWS / 2);
  const snake: Cell[] = [
    { x: startX, y: startY },
    { x: startX - 1, y: startY },
    { x: startX - 2, y: startY },
  ];

  const score = 0;
  const level = 1;
  let finished = false;
  let rafId = 0;

  // ── Fin de partida ──────────────────────────────────────────────────────────
  function finish() {
    if (finished) return;
    finished = true;
    notify();
    onGameOver(score);
  }

  // ── Notificación de estado a React ──────────────────────────────────────────
  let last: GameState = { score: -1, lives: -1, level: -1 };

  function notify() {
    const nextState: GameState = { score, lives: 1, level };
    if (nextState.score !== last.score || nextState.level !== last.level) {
      last = nextState;
      onState(nextState);
    }
  }

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  function drawGrid() {
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL, 0);
      ctx.lineTo(c * CELL, H);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(W, r * CELL);
      ctx.stroke();
    }
  }

  function drawSnake() {
    snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? "#00ff88" : "#00c46a";
      ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
    });
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    drawGrid();
    drawSnake();
  }

  // ── Loop principal ──────────────────────────────────────────────────────────
  // El paso fijo (acumulador + tick por moveInterval) llega en el siguiente
  // paso del plan; por ahora el rAF solo redibuja cada frame.
  function loop() {
    draw();
    rafId = requestAnimationFrame(loop);
  }

  notify();
  rafId = requestAnimationFrame(loop);

  return {
    stop() {
      cancelAnimationFrame(rafId);
    },
    setPaused() {
      // Se cablea en el paso del loop a paso fijo.
    },
    endGame() {
      finish();
    },
  };
}
