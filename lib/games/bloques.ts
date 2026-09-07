// Portado de references/started-games/04-arkanoid/. La mecánica es verbatim;
// lo único que cambia es el dibujo: el original usa un spritesheet PNG y aquí
// todo son fillRect, para no meter un PNG en public/ ni un loader asíncrono.
// Los dos MP3 del original sí se portan (SPEC 09), pero no necesitan carga.
// Todo el estado vive dentro de startBloques() para que dos montajes no
// compartan paleta ni bola. No se escribe en el DOM ni en localStorage: el
// overlay, los botones y el ranking los pone la plataforma.

import type { GameCallbacks, GameHandle, GameState } from "./registry";

const W = 800; // mismo buffer que rocas y caida: .game-canvas es 4/3
const H = 600;

const PADDLE_SPEED = 400;
const BLOCK_COLS = 10;
const BLOCK_ROWS = 6;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const EXPLOSION_DURATION = 150; // ms, de assets/spritesheet.js del original

const GAME_KEYS = ["ArrowLeft", "ArrowRight"];

// Los cuatro primeros son los del CRT (app/globals.css); los tres restantes
// completan los nombres que usan los niveles del original.
const COLORS: Record<string, string> = {
  cyan: "#00f5ff",
  magenta: "#ff006e",
  yellow: "#f5ff00",
  green: "#00ff88",
  red: "#ff2a2a",
  hotpink: "#ff5fc8",
  gray: "#9e9e9e",
};

const hex = (name: string) => COLORS[name] ?? "#fff";

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alive: boolean;
}

interface Explosion {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  elapsed: number;
}

interface LevelBlock {
  col: number;
  row: number;
  color: string;
}

interface Level {
  speed: number;
  blocks: LevelBlock[];
}

// Copiado de references/started-games/04-arkanoid/levels.js, sin cambios.
const LEVELS: Level[] = (() => {
  const rowColors1 = ["red", "yellow", "cyan", "magenta", "hotpink", "green"];
  const rowColors2 = ["gray", "cyan", "hotpink", "yellow", "magenta", "green"];
  const rowColors4 = ["cyan", "magenta", "green", "yellow", "hotpink", "red"];

  const l1: LevelBlock[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      l1.push({ col, row, color: rowColors1[row] });

  const l2: LevelBlock[] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });

  const l3: LevelBlock[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      if ((col + row) % 2 === 0)
        l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });

  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: LevelBlock[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      if (!gaps4[row].includes(col))
        l4.push({ col, row, color: rowColors4[row] });

  const l5: LevelBlock[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({ col, row, color: isCross && !isFrame ? "hotpink" : "cyan" });
    }

  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
})();

export function startBloques(
  canvas: HTMLCanvasElement,
  { onState, onGameOver }: GameCallbacks,
): GameHandle {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const paddle = { x: 0, y: 560, w: 81, h: 14 };
  const ball = { x: 0, y: 0, w: 16, h: 16, vx: BASE_BALL_VX, vy: BASE_BALL_VY };
  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let lives = 3;
  let score = 0;
  let currentLevel = 1;
  let gameState: "playing" | "gameover" | "win" = "playing";
  let paused = false;
  let finished = false; // onGameOver se emite una sola vez por partida
  let lastTime: number | null = null;
  let rafId = 0;

  // Los dos Audio se construyen aquí, no a nivel de módulo: este archivo acaba
  // en el grafo de un Server Component y el constructor no existe allí. El mute
  // lo decide la plataforma vía setMuted(); el juego no lee localStorage.
  const bounceSound = new Audio("/sounds/ball-bounce.mp3");
  const breakSound = new Audio("/sounds/break-sound.mp3");
  let muted = false;

  // cloneNode() como el original: dos golpes seguidos se solapan en vez de
  // cortarse. El catch se traga el rechazo de la política de autoplay, que es
  // esperable antes del primer clic; el sonido es adorno, no mecánica.
  function play(sound: HTMLAudioElement) {
    if (muted) return;
    (sound.cloneNode() as HTMLAudioElement).play().catch(() => {});
  }

  const keys = { ArrowLeft: false, ArrowRight: false };

  function initBall() {
    const { speed } = LEVELS[currentLevel - 1];
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }

  function loadLevel(n: number) {
    currentLevel = n;
    const level = LEVELS[n - 1];
    blocks = level.blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    explosions = [];
    initBall();
  }

  // ── Fin de partida ──────────────────────────────────────────────────────────
  // Tres caminos (0 vidas, nivel 5 completado, botón FIN) y un solo evento.
  function finish() {
    if (finished) return;
    finished = true;
    notify();
    onGameOver(score);
  }

  // ── Notificación de estado a React ──────────────────────────────────────────
  let last: GameState = { score: -1, lives: -1, level: -1 };

  function notify() {
    const nextState: GameState = { score, lives, level: currentLevel };
    if (
      nextState.score !== last.score ||
      nextState.lives !== last.lives ||
      nextState.level !== last.level
    ) {
      last = nextState;
      onState(nextState);
    }
  }

  function collideAABB(block: Block) {
    return (
      ball.x < block.x + block.w &&
      ball.x + ball.w > block.x &&
      ball.y < block.y + block.h &&
      ball.y + ball.h > block.y
    );
  }

  function update(dt: number) {
    // finished cubre el botón FIN, que acaba la partida sin tocar gameState.
    if (finished || gameState !== "playing") return;

    // Paleta
    if (keys.ArrowLeft) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (keys.ArrowRight)
      paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

    // Movimiento de la bola
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Rebotes contra las paredes (izquierda, derecha, techo)
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      play(bounceSound);
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
      play(bounceSound);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      play(bounceSound);
    }

    // Rebote contra la paleta
    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
      play(bounceSound);
    }

    // Colisión con los bloques
    for (const block of blocks) {
      if (!block.alive) continue;
      if (collideAABB(block)) {
        block.alive = false;
        play(breakSound);
        explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        score += 10;
        ball.vy = -ball.vy;
        if (blocks.every((b) => !b.alive)) {
          if (currentLevel < LEVELS.length) loadLevel(currentLevel + 1);
          else {
            gameState = "win";
            finish();
          }
        }
        notify();
        break; // un bloque por frame
      }
    }

    // Explosiones
    for (const exp of explosions) exp.elapsed += dt * 1000;
    explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

    // Bola perdida
    if (ball.y > H) {
      lives--;
      if (lives <= 0) {
        lives = 0;
        gameState = "gameover";
        finish();
      } else {
        initBall();
      }
      notify();
    }
  }

  // Un rect con una banda clara arriba, el mismo truco de volumen que caida.
  function fillBlock(
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
  ) {
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x + 1, y + 1, w - 2, 4);
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    for (const block of blocks) {
      if (block.alive)
        fillBlock(block.x, block.y, block.w, block.h, hex(block.color));
    }

    // El original anima 4 frames del spritesheet; aquí el bloque se desvanece.
    for (const exp of explosions) {
      ctx.globalAlpha = Math.max(0, 1 - exp.elapsed / EXPLOSION_DURATION);
      fillBlock(exp.x, exp.y, exp.w, exp.h, hex(exp.color));
      ctx.globalAlpha = 1;
    }

    fillBlock(paddle.x, paddle.y, paddle.w, paddle.h, COLORS.cyan);
    fillBlock(ball.x, ball.y, ball.w, ball.h, COLORS.yellow);

    // HUD del canvas, duplicado a propósito con el HUD React.
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.fillText("PUNTUACIÓN", 16, 16);
    ctx.textAlign = "center";
    ctx.fillText("NIVEL", W / 2, 16);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px monospace";
    ctx.textAlign = "left";
    ctx.fillText(score.toLocaleString("es-ES"), 16, 32);
    ctx.textAlign = "center";
    ctx.fillText(String(currentLevel), W / 2, 32);

    const size = 16;
    for (let i = 0; i < lives; i++) {
      const bx = W - 16 - (lives - i) * (size + 4);
      fillBlock(bx, 16, size, size, COLORS.yellow);
    }
  }

  // ── Teclado ─────────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.includes(e.key)) e.preventDefault();
    if (e.key in keys) keys[e.key as keyof typeof keys] = true;
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key in keys) keys[e.key as keyof typeof keys] = false;
  };

  // ── Ratón ───────────────────────────────────────────────────────────────────
  // Única desviación del port verbatim: el handler escribe paddle.x fuera de
  // update(), así que la regla "en pausa no se llama a update()" no lo alcanza.
  // Sin esta guarda la paleta seguiría al ratón en pausa y tras el fin de partida.
  const onMouseMove = (e: MouseEvent) => {
    if (paused || finished) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    paddle.x = Math.max(0, Math.min(W - paddle.w, mouseX - paddle.w / 2));
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("mousemove", onMouseMove);

  // ── Loop principal ──────────────────────────────────────────────────────────
  function loop(ts: number) {
    const dt = lastTime === null ? 0 : (ts - lastTime) / 1000;
    lastTime = ts;

    if (!paused) update(dt);
    draw();

    rafId = requestAnimationFrame(loop);
  }

  paddle.x = (W - paddle.w) / 2;
  loadLevel(1);
  notify();
  rafId = requestAnimationFrame(loop);

  return {
    stop() {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousemove", onMouseMove);
    },
    setPaused(p: boolean) {
      paused = p;
      if (!p) lastTime = null; // evita que dt acumule el tiempo en pausa
    },
    endGame() {
      finish();
    },
    setMuted(m: boolean) {
      muted = m;
    },
  };
}
