// Diseñado desde cero para SPEC 01 (game-jam/rana) — no hay game.js de
// referencia que portar, igual que snake en SPEC 10. Todo el estado vive
// dentro de startRana() para que dos montajes no compartan tablero. No se
// escribe en el DOM ni en localStorage: el overlay, los botones y el
// ranking los pone la plataforma.

import type { GameCallbacks, GameHandle, GameState } from "./registry";

const CELL = 40;
const COLS = 20; // 800 / 40
const ROWS = 15; // 600 / 40
const W = COLS * CELL; // 800
const H = ROWS * CELL; // 600

// Filas, de arriba (0) hacia abajo (14):
const GOAL_ROW = 0; // 5 nenúfares
const RIVER_ROWS = [1, 2, 3, 4, 5]; // troncos
const MEDIAN_ROW = 6; // segura
const ROAD_ROWS = [7, 8, 9, 10, 11]; // coches
// filas 12-14: zona de salida, segura

const SLOT_COLS = [1, 5, 9, 13, 17]; // columnas de los 5 nenúfares
const STARTING_ROW = 14;
const STARTING_COL = 9; // alineado con el nenúfar central

const MOVE_COOLDOWN_MS = 120;

const COLORS = {
  safe: "#173a2b",
  road: "#2b2b2b",
  median: "#173a2b",
  river: "#0d3b4d",
  goal: "#0f2e24",
  lily: "#2f7d3f",
  lilyFilled: "#4dd07a",
  frog: "#7ee081",
  car: "#e57373",
  log: "#8d5b32",
};

interface LaneConfig {
  row: number;
  dir: 1 | -1; // 1 = derecha, -1 = izquierda
  speed: number; // px/s, antes del multiplicador de nivel
  w: number; // ancho de cada obstáculo
  gap: number; // separación entre obstáculos consecutivos
}

interface Lane extends LaneConfig {
  obstacles: { x: number }[];
}

// Valores de referencia del spec: mantienen la variedad dir/velocidad entre carriles.
const ROAD_LANE_CONFIG: LaneConfig[] = [
  { row: 7, dir: -1, speed: 90, w: 60, gap: 160 },
  { row: 8, dir: 1, speed: 130, w: 60, gap: 200 },
  { row: 9, dir: -1, speed: 110, w: 80, gap: 220 },
  { row: 10, dir: 1, speed: 150, w: 60, gap: 180 },
  { row: 11, dir: -1, speed: 100, w: 70, gap: 200 },
];

const RIVER_LANE_CONFIG: LaneConfig[] = [
  { row: 1, dir: 1, speed: 70, w: 120, gap: 100 },
  { row: 2, dir: -1, speed: 90, w: 100, gap: 140 },
  { row: 3, dir: 1, speed: 80, w: 140, gap: 120 },
  { row: 4, dir: -1, speed: 60, w: 100, gap: 160 },
  { row: 5, dir: 1, speed: 100, w: 120, gap: 100 },
];

function createLane(config: LaneConfig): Lane {
  const span = config.w + config.gap;
  const count = Math.ceil(W / span) + 1;
  const obstacles = Array.from({ length: count }, (_, i) => ({ x: i * span }));
  return { ...config, obstacles };
}

export function startRana(
  canvas: HTMLCanvasElement,
  { onState, onGameOver }: GameCallbacks,
): GameHandle {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const frog = { x: STARTING_COL * CELL, row: STARTING_ROW };
  const slots: boolean[] = [false, false, false, false, false];
  const roadLanes: Lane[] = ROAD_LANE_CONFIG.map(createLane);
  const riverLanes: Lane[] = RIVER_LANE_CONFIG.map(createLane);

  let score = 0;
  let lives = 3;
  let level = 1;
  let speedMultiplier = 1;
  let lastMoveAt = -Infinity;
  let bestRowThisLife = STARTING_ROW; // para la puntuación por avance

  let paused = false;
  let finished = false;
  let lastTime: number | null = null;
  let rafId = 0;

  // ── Sonido ────────────────────────────────────────────────────────────────
  // Sintetizado con Web Audio API: no hay ningún game.js de Frogger que
  // portar assets desde, a diferencia de bloques (SPEC 09). audioCtx se crea
  // perezosamente en el primer beep(), nunca a nivel de módulo (no existe en
  // el servidor). muted lo controla la plataforma vía setMuted().
  let audioCtx: AudioContext | null = null;
  let muted = false;
  const pendingMelodyTimeouts: ReturnType<typeof setTimeout>[] = [];

  function beep(
    freq: number,
    durationMs: number,
    type: OscillatorType,
    glideToFreq?: number,
  ) {
    if (muted) return;
    audioCtx ??= new AudioContext();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (glideToFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        glideToFreq,
        audioCtx.currentTime + durationMs / 1000,
      );
    }
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + durationMs / 1000,
    );
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + durationMs / 1000);
  }

  // Encadena notas en el tiempo: beep() siempre arranca en audioCtx.currentTime,
  // así que una melodía ascendente necesita programar cada nota con setTimeout.
  function playMelody(notes: { freq: number; durationMs: number }[]) {
    let offset = 0;
    for (const note of notes) {
      pendingMelodyTimeouts.push(
        setTimeout(() => beep(note.freq, note.durationMs, "sine"), offset),
      );
      offset += note.durationMs;
    }
  }

  // ── Fin de partida ───────────────────────────────────────────────────────
  function finish() {
    if (finished) return;
    finished = true;
    notify();
    onGameOver(score);
  }

  // ── Notificación de estado a React ───────────────────────────────────────
  let last: GameState = { score: -1, lives: -1, level: -1 };

  function notify() {
    const nextState: GameState = { score, lives, level };
    if (
      nextState.score !== last.score ||
      nextState.lives !== last.lives ||
      nextState.level !== last.level
    ) {
      last = nextState;
      onState(nextState);
    }
  }

  // ── Dibujo ────────────────────────────────────────────────────────────────
  function rowY(row: number) {
    return row * CELL;
  }

  function drawBoard() {
    ctx.fillStyle = COLORS.safe;
    ctx.fillRect(0, rowY(12), W, CELL * 3); // filas de salida (12-14)

    ctx.fillStyle = COLORS.road;
    ctx.fillRect(0, rowY(ROAD_ROWS[0]), W, CELL * ROAD_ROWS.length);

    ctx.fillStyle = COLORS.median;
    ctx.fillRect(0, rowY(MEDIAN_ROW), W, CELL);

    ctx.fillStyle = COLORS.river;
    ctx.fillRect(0, rowY(RIVER_ROWS[0]), W, CELL * RIVER_ROWS.length);

    ctx.fillStyle = COLORS.goal;
    ctx.fillRect(0, rowY(GOAL_ROW), W, CELL);

    for (let i = 0; i < SLOT_COLS.length; i++) {
      ctx.fillStyle = slots[i] ? COLORS.lilyFilled : COLORS.lily;
      const cx = SLOT_COLS[i] * CELL + CELL / 2;
      const cy = rowY(GOAL_ROW) + CELL / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFrog() {
    ctx.fillStyle = COLORS.frog;
    ctx.fillRect(frog.x + 4, rowY(frog.row) + 4, CELL - 8, CELL - 8);
  }

  function fillLaneObstacles(lane: Lane, color: string) {
    ctx.fillStyle = color;
    for (const obs of lane.obstacles) {
      ctx.fillRect(obs.x + 2, rowY(lane.row) + 4, lane.w - 4, CELL - 8);
    }
  }

  function drawLanes() {
    for (const lane of roadLanes) fillLaneObstacles(lane, COLORS.car);
    for (const lane of riverLanes) fillLaneObstacles(lane, COLORS.log);
  }

  // HUD del canvas, duplicado a propósito con el HUD React. Vive en la
  // primera fila de salida (12) — la rana la cruza en cada intento, así que
  // lleva una franja translúcida detrás para seguir siendo legible.
  function drawHud() {
    const y0 = rowY(12);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, y0, W, CELL);

    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText("PUNTUACIÓN", 12, y0 + 2);
    ctx.textAlign = "center";
    ctx.fillText("NIVEL", W / 2, y0 + 2);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "left";
    ctx.fillText(score.toLocaleString("es-ES"), 12, y0 + 14);
    ctx.textAlign = "center";
    ctx.fillText(String(level), W / 2, y0 + 14);

    const size = 14;
    for (let i = 0; i < lives; i++) {
      const bx = W - 12 - (lives - i) * (size + 4);
      ctx.fillStyle = COLORS.frog;
      ctx.fillRect(bx, y0 + 12, size, size);
    }
  }

  function draw() {
    drawBoard();
    drawLanes();
    drawFrog();
    drawHud();
  }

  // ── Actualización ───────────────────────────────────────────────────────────
  function advanceLane(lane: Lane, dt: number) {
    const vx = lane.dir * lane.speed * speedMultiplier * dt;
    for (const obs of lane.obstacles) {
      obs.x += vx;
      if (lane.dir === 1 && obs.x > W) obs.x = -lane.w;
      else if (lane.dir === -1 && obs.x + lane.w < 0) obs.x = W;
    }
  }

  function rectsOverlap(
    ax: number,
    ay: number,
    aw: number,
    ah: number,
    bx: number,
    by: number,
    bw: number,
    bh: number,
  ) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function respawnPosition() {
    frog.x = STARTING_COL * CELL;
    frog.row = STARTING_ROW;
  }

  // lives === 0 termina la partida; si no, reaparece en la salida y arranca
  // una vida nueva (bestRowThisLife se reinicia; una llegada a nenúfar no lo
  // hace, esa es la misma vida siguiendo). cause solo decide qué beep suena:
  // atropello = coche en la carretera, ahogo = todo lo demás (río sin tronco,
  // tronco que saca del canvas, o aterrizar en el río más allá de un nenúfar).
  function loseLife(cause: "atropello" | "ahogo") {
    if (cause === "atropello") beep(220, 150, "sawtooth", 80);
    else beep(400, 200, "triangle", 100);
    lives--;
    if (lives <= 0) {
      lives = 0;
      finish();
      return;
    }
    respawnPosition();
    bestRowThisLife = STARTING_ROW;
    notify();
  }

  // Solo se llama en el instante en que un salto deja a la rana en GOAL_ROW.
  function handleGoalRow(col: number) {
    const slotIndex = SLOT_COLS.indexOf(col);
    if (slotIndex === -1 || slots[slotIndex]) {
      loseLife("ahogo");
      return;
    }
    slots[slotIndex] = true;
    score += 50;
    respawnPosition();
    playMelody([
      { freq: 523, durationMs: 80 },
      { freq: 659, durationMs: 80 },
    ]);

    if (slots.every(Boolean)) {
      score += 100;
      slots.fill(false);
      level++;
      speedMultiplier = Math.min(2.5, 1 + (level - 1) * 0.15);
      playMelody([
        { freq: 523, durationMs: 70 },
        { freq: 659, durationMs: 70 },
        { freq: 784, durationMs: 70 },
        { freq: 1047, durationMs: 70 },
      ]);
    }
  }

  function checkRoadCollision() {
    const lane = roadLanes.find((l) => l.row === frog.row);
    if (!lane) return;
    const hit = lane.obstacles.some((obs) =>
      rectsOverlap(
        frog.x,
        rowY(frog.row),
        CELL,
        CELL,
        obs.x,
        rowY(lane.row),
        lane.w,
        CELL,
      ),
    );
    if (hit) loseLife("atropello");
  }

  // Sin tronco debajo: pierde una vida de inmediato. Con tronco: la arrastra
  // con su movimiento; si eso la saca por completo del canvas, pierde una vida.
  function checkRiverCollision(dt: number) {
    const lane = riverLanes.find((l) => l.row === frog.row);
    if (!lane) return;
    const log = lane.obstacles.find((obs) =>
      rectsOverlap(
        frog.x,
        rowY(frog.row),
        CELL,
        CELL,
        obs.x,
        rowY(lane.row),
        lane.w,
        CELL,
      ),
    );
    if (!log) {
      loseLife("ahogo");
      return;
    }
    frog.x += lane.dir * lane.speed * speedMultiplier * dt;
    if (frog.x + CELL < 0 || frog.x > W) loseLife("ahogo");
  }

  function update(dt: number) {
    if (paused || finished) return;
    for (const lane of roadLanes) advanceLane(lane, dt);
    for (const lane of riverLanes) advanceLane(lane, dt);

    if (ROAD_ROWS.includes(frog.row)) checkRoadCollision();
    else if (RIVER_ROWS.includes(frog.row)) checkRiverCollision(dt);
  }

  // ── Teclado ────────────────────────────────────────────────────────────────
  // Flechas y WASD saltan una celda por pulsación; el cooldown ignora el
  // auto-repeat del teclado del sistema operativo.
  const KEY_DELTAS: Record<string, { dRow: number; dCol: number }> = {
    ArrowUp: { dRow: -1, dCol: 0 },
    ArrowDown: { dRow: 1, dCol: 0 },
    ArrowLeft: { dRow: 0, dCol: -1 },
    ArrowRight: { dRow: 0, dCol: 1 },
    KeyW: { dRow: -1, dCol: 0 },
    KeyS: { dRow: 1, dCol: 0 },
    KeyA: { dRow: 0, dCol: -1 },
    KeyD: { dRow: 0, dCol: 1 },
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const delta = KEY_DELTAS[e.code];
    if (!delta) return;
    e.preventDefault();
    if (paused || finished) return;

    const now = Date.now();
    if (now - lastMoveAt < MOVE_COOLDOWN_MS) return;
    lastMoveAt = now;
    beep(600, 60, "square");

    const col = Math.max(
      0,
      Math.min(COLS - 1, Math.round(frog.x / CELL) + delta.dCol),
    );
    const row = Math.max(0, Math.min(ROWS - 1, frog.row + delta.dRow));
    frog.x = col * CELL;
    frog.row = row;

    // Puntuación por avance: solo cuenta la primera vez que se alcanza una
    // fila más profunda en la vida actual; repetirla o retroceder no puntúa.
    if (row < bestRowThisLife) {
      score += 10;
      bestRowThisLife = row;
    }

    if (row === GOAL_ROW) handleGoalRow(col);

    notify();
  };
  window.addEventListener("keydown", onKeyDown);

  // ── Loop principal ────────────────────────────────────────────────────────
  // rAF redibuja cada frame para que la pausa no deje el tablero en negro.
  function loop(ts: number) {
    const dt = lastTime === null ? 0 : (ts - lastTime) / 1000;
    lastTime = ts;

    if (!paused) update(dt);
    draw();

    rafId = requestAnimationFrame(loop);
  }

  notify();
  rafId = requestAnimationFrame(loop);

  return {
    stop() {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      pendingMelodyTimeouts.forEach(clearTimeout);
      audioCtx?.close();
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
