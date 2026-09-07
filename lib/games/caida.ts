// Portado casi verbatim de references/started-games/03-tetris/game.js.
// Todo el estado vive dentro de startCaida() para que dos montajes no compartan
// tablero. No se escribe en el DOM ni en localStorage: el overlay, los botones
// y el ranking los pone la plataforma.

import type { GameCallbacks, GameHandle, GameState } from "./registry";

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const W = 800; // mismo buffer que Asteroids: .game-canvas es 4/3
const H = 600;
const BOARD_X = (W - COLS * BLOCK) / 2; // 250 — tablero centrado
const PANEL_X = 580; // HUD del juego y panel SIGUIENTE, a la derecha
const PANEL_Y = 60; // desfase propio: no alinea con el borde del tablero

// Índice 0 = celda vacía; drawBlock() sale antes de llegar a él.
const COLORS = [
  "",
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#90caf9", // J - pale blue
  "#ffb74d", // L - orange
  "#9e9e9e", // N - tuerca (gris metálico)
];

const PIECES: number[][][] = [
  [],
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const GAME_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"];

interface Piece {
  type: number;
  shape: number[][];
  x: number;
  y: number;
}

export function startCaida(
  canvas: HTMLCanvasElement,
  { onState, onGameOver }: GameCallbacks,
): GameHandle {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // clearLines() lo muta con splice/unshift; nunca se reasigna.
  const board = Array.from({ length: ROWS }, () =>
    new Array<number>(COLS).fill(0),
  );
  let current: Piece;
  let next: Piece;
  let score = 0;
  let lines = 0;
  let level = 1;
  let gameOver = false;
  let paused = false;
  let lastTime: number | null = null;
  let dropAccum = 0;
  let dropInterval = 1000;
  let rafId = 0;

  function randomPiece(): Piece {
    const type = Math.floor(Math.random() * 8) + 1;
    const shape = PIECES[type].map((row) => [...row]);
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }

  function collide(shape: number[][], ox: number, oy: number) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function rotateCW(shape: number[][]) {
    const rows = shape.length;
    const cols = shape[0].length;
    const result = Array.from({ length: cols }, () =>
      new Array<number>(rows).fill(0),
    );
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
    return result;
  }

  function tryRotate() {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
      notify();
    }
  }

  function ghostY() {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function hardDrop() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
      notify();
    } else {
      lockPiece();
    }
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) finish();
  }

  // ── Fin de partida ──────────────────────────────────────────────────────────
  // Es un evento y se emite una sola vez por partida.
  function finish() {
    if (gameOver) return;
    gameOver = true;
    notify();
    onGameOver(score);
  }

  // ── Notificación de estado a React ──────────────────────────────────────────
  let last: GameState = { score: -1, lives: -1, level: -1, lines: -1 };

  function notify() {
    const nextState: GameState = { score, lives: 1, level, lines };
    if (
      nextState.score !== last.score ||
      nextState.level !== last.level ||
      nextState.lines !== last.lines
    ) {
      last = nextState;
      onState(nextState);
    }
  }

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  function drawBlock(
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha = 1,
  ) {
    if (!colorIndex) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS[colorIndex];
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    ctx.globalAlpha = 1;
  }

  function drawGrid() {
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(COLS * BLOCK, r * BLOCK);
      ctx.stroke();
    }
  }

  function drawBoard() {
    ctx.save();
    ctx.translate(BOARD_X, 0);

    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, COLS * BLOCK, ROWS * BLOCK);

    drawGrid();

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) drawBlock(c, r, board[r][c], BLOCK);

    // Sombra de caída
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

    // Pieza actual
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(current.x + c, current.y + r, current.shape[r][c], BLOCK, 1);

    ctx.restore();
  }

  // Mismo contenido y orden que el sidebar del original, dibujado en el canvas.
  function drawPanel() {
    ctx.save();
    ctx.translate(PANEL_X, PANEL_Y);
    ctx.textAlign = "left";

    const stats: [string, string][] = [
      ["PUNTUACIÓN", score.toLocaleString("es-ES")],
      ["LÍNEAS", String(lines)],
      ["NIVEL", String(level)],
    ];

    let y = 0;
    for (const [label, value] of stats) {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "11px monospace";
      ctx.fillText(label, 0, y);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 22px monospace";
      ctx.fillText(value, 0, y + 24);
      y += 56;
    }

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "11px monospace";
    ctx.fillText("SIGUIENTE", 0, y);

    ctx.save();
    ctx.translate(0, y + 12);
    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(offX + c, offY + r, shape[r][c], BLOCK);
    ctx.restore();

    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    drawBoard();
    drawPanel();
  }

  // ── Teclado ─────────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (paused || gameOver) return;
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
    }
    notify();
  };
  window.addEventListener("keydown", onKeyDown);

  // ── Loop principal ──────────────────────────────────────────────────────────
  function loop(ts: number) {
    const dt = lastTime === null ? 0 : ts - lastTime;
    lastTime = ts;

    if (!paused && !gameOver) {
      dropAccum += dt;
      if (dropAccum >= dropInterval) {
        dropAccum = 0;
        if (!collide(current.shape, current.x, current.y + 1)) current.y++;
        else lockPiece();
      }
    }

    draw();
    rafId = requestAnimationFrame(loop);
  }

  next = randomPiece();
  spawn();
  notify();
  rafId = requestAnimationFrame(loop);

  return {
    stop() {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
    },
    setPaused(p: boolean) {
      paused = p;
      if (!p) lastTime = null; // evita que dropAccum salte el tiempo en pausa
    },
    endGame() {
      finish();
    },
  };
}
