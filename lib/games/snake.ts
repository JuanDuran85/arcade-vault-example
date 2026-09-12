// Diseñado desde cero para SPEC 10 — no hay game.js de referencia que portar.
// Todo el estado vive dentro de startSnake() para que dos montajes no
// compartan tablero. No se escribe en el DOM ni en localStorage: el overlay,
// los botones y el ranking los pone la plataforma.

import type { GameCallbacks, GameHandle, GameState } from "./registry";
import { SKINS, type Skin } from "./skins";

// skin.accent con opacidad, para distinguir la cola de la cabeza sin un rol
// nuevo (mismo truco que withAlpha en bloques.ts).
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
}

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
  skin: Skin = SKINS.clasico,
): GameHandle {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Construido aquí, no a nivel de módulo: Image no existe en el servidor y
  // este archivo acaba en el grafo de un Server Component. Carga async, sin
  // estado "cargando" nuevo — mientras no está lista, drawFruit() cae al
  // fillRect verde de siempre.
  const fruitImg = new Image();
  fruitImg.src = "/sprites/fruits.png";

  // Cabeza en el índice 0, 3 segmentos iniciales, centrada y mirando a la derecha.
  const startX = Math.floor(COLS / 2);
  const startY = Math.floor(ROWS / 2);
  const snake: Cell[] = [
    { x: startX, y: startY },
    { x: startX - 1, y: startY },
    { x: startX - 2, y: startY },
  ];

  let dir: Cell = { x: 1, y: 0 };
  let nextDir: Cell = dir; // buffer: el giro se aplica en el próximo tick
  let moveInterval = BASE_INTERVAL;
  let acc = 0; // acumulador de tiempo para el paso fijo

  let score = 0;
  let level = 1;
  let finished = false;
  let paused = false;
  let lastTime: number | null = null;
  let rafId = 0;
  let fruit: { x: number; y: number; spriteIndex: number };

  // Celda libre al azar (ninguna casilla de la serpiente); O(COLS*ROWS) por
  // spawn, un tablero de 40×40 no lo nota.
  function spawnFruit() {
    const free: Cell[] = [];
    for (let x = 0; x < COLS; x++)
      for (let y = 0; y < ROWS; y++)
        if (!snake.some((seg) => seg.x === x && seg.y === y))
          free.push({ x, y });
    const cell = free[Math.floor(Math.random() * free.length)];
    fruit = {
      x: cell.x,
      y: cell.y,
      spriteIndex: Math.floor(Math.random() * FRUITS.length),
    };
  }

  // ── Movimiento a paso fijo, colisiones y crecimiento ────────────────────────
  function tick() {
    dir = nextDir;
    const head = snake[0];
    const newHead: Cell = { x: head.x + dir.x, y: head.y + dir.y };

    if (
      newHead.x < 0 ||
      newHead.x >= COLS ||
      newHead.y < 0 ||
      newHead.y >= ROWS
    ) {
      finish();
      return;
    }

    const willGrow = newHead.x === fruit.x && newHead.y === fruit.y;
    // La cola se libera este mismo tick si no se crece, así que no cuenta
    // como colisión contra uno mismo.
    const body = willGrow ? snake : snake.slice(0, -1);
    if (body.some((seg) => seg.x === newHead.x && seg.y === newHead.y)) {
      finish();
      return;
    }

    snake.unshift(newHead);
    if (willGrow) {
      score += POINTS_PER_FRUIT;
      if (score % POINTS_PER_LEVEL === 0) {
        level++;
        moveInterval = Math.max(MIN_INTERVAL, BASE_INTERVAL - (level - 1) * 10);
      }
      spawnFruit();
      notify();
    } else {
      snake.pop();
    }
  }

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
    ctx.strokeStyle = skin.grid;
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
      ctx.fillStyle = i === 0 ? skin.accent : withAlpha(skin.accent, 0.65);
      ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
    });
  }

  function drawFruit() {
    const px = fruit.x * CELL;
    const py = fruit.y * CELL;
    if (fruitImg.complete) {
      const sprite = FRUITS[fruit.spriteIndex];
      ctx.drawImage(
        fruitImg,
        sprite.x,
        sprite.y,
        sprite.w,
        sprite.h,
        px,
        py,
        CELL,
        CELL,
      );
    } else {
      // Fallback mientras carga la imagen: dura como mucho un par de frames.
      ctx.fillStyle = skin.accent2;
      ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
    }
  }

  function draw() {
    ctx.fillStyle = skin.bg;
    ctx.fillRect(0, 0, W, H);
    drawGrid();
    drawFruit();
    drawSnake();
  }

  // ── Teclado ─────────────────────────────────────────────────────────────────
  // Flechas y WASD escriben el mismo buffer nextDir; ninguno dispara tick()
  // directamente, así que un giro no puede aplicarse dos veces en el mismo paso.
  const ARROW_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

  const KEY_DIRS: Record<string, Cell> = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    KeyW: { x: 0, y: -1 },
    KeyS: { x: 0, y: 1 },
    KeyA: { x: -1, y: 0 },
    KeyD: { x: 1, y: 0 },
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (ARROW_KEYS.includes(e.code)) e.preventDefault();
    const candidate = KEY_DIRS[e.code];
    if (!candidate) return;
    // No te puedes morder invirtiendo sobre ti mismo en el mismo tick: se
    // compara contra dir (la última dirección aplicada), no contra nextDir.
    if (candidate.x === -dir.x && candidate.y === -dir.y) return;
    nextDir = candidate;
  };
  window.addEventListener("keydown", onKeyDown);

  // ── Loop principal ──────────────────────────────────────────────────────────
  // rAF redibuja cada frame para que la pausa no deje el canvas en negro; el
  // acumulador dispara tick() a paso fijo, independiente del framerate.
  function loop(ts: number) {
    const dt = lastTime === null ? 0 : ts - lastTime;
    lastTime = ts;

    if (!paused) {
      acc += dt;
      while (acc >= moveInterval) {
        tick();
        acc -= moveInterval;
      }
    }

    draw();
    rafId = requestAnimationFrame(loop);
  }

  spawnFruit();
  notify();
  rafId = requestAnimationFrame(loop);

  return {
    stop() {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
    },
    setPaused(p: boolean) {
      paused = p;
      if (!p) lastTime = null; // evita que acc salte el tiempo en pausa
    },
    endGame() {
      finish();
    },
  };
}
