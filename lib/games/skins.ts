// El contrato de skins: seis roles, tres skins, nada más. Ver
// references/game-with-themes.md para qué juego usa cuál rol y por qué.

export type SkinId = "clasico" | "neon" | "retro";

export interface Skin {
  bg: string; // fondo del canvas
  ink: string; // texto y trazo principal
  grid: string; // rejillas y líneas tenues (rgba)
  accent: string; // el jugador / la pieza activa
  accent2: string; // enemigos, proyectiles, fruta
  warn: string; // peligro, vidas perdidas
  glow?: number; // px de shadowBlur en los trazos; ausente = sin brillo
}

export const SKINS: Record<SkinId, Skin> = {
  // Exactamente los colores de hoy (negro, blanco, cian, rejilla tenue).
  // Migrar un juego a clasico no puede cambiar un pixel.
  clasico: {
    bg: "#000",
    ink: "#fff",
    grid: "rgba(255,255,255,0.06)",
    accent: "#0ff",
    accent2: "#f0f",
    warn: "rgba(255,130,0,0.85)",
  },
  // Los tokens de la plataforma (app/globals.css).
  neon: {
    bg: "#07060f",
    ink: "#b8f4ff",
    grid: "rgba(0,245,255,0.22)",
    accent: "#00f5ff",
    accent2: "#ff2bd6",
    warn: "#ff0055",
    glow: 16,
  },
  // Fósforo ámbar/verde sobre negro cálido.
  retro: {
    bg: "#1a1207",
    ink: "#ffb000",
    grid: "rgba(255,176,0,0.12)",
    accent: "#33ff33",
    accent2: "#00cc66",
    warn: "#ff3300",
  },
};
