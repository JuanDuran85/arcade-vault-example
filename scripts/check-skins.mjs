// Comprueba que ink/accent/accent2/warn de cada skin lean sobre bg con al
// menos 3:1 de contraste WCAG. La plataforma es dark-only: no hay modo claro
// que soportar, solo esto.
import assert from "node:assert";
import { SKINS } from "../lib/games/skins.ts";

function parseColor(str) {
  const hex = str.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1];
    const full =
      h.length === 3
        ? h
            .split("")
            .map((c) => c + c)
            .join("")
        : h;
    const n = parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgba = str.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i,
  );
  if (rgba) {
    return {
      r: +rgba[1],
      g: +rgba[2],
      b: +rgba[3],
      a: rgba[4] !== undefined ? +rgba[4] : 1,
    };
  }
  throw new Error(`color sin parsear: ${str}`);
}

// Compone un color (posiblemente translúcido) sobre bg opaco.
function compositeOverBg(color, bg) {
  const c = parseColor(color);
  const base = parseColor(bg);
  return {
    r: c.r * c.a + base.r * (1 - c.a),
    g: c.g * c.a + base.g * (1 - c.a),
    b: c.b * c.a + base.b * (1 - c.a),
  };
}

function relativeLuminance({ r, g, b }) {
  const chan = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

function contrastRatio(a, b) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const ROLES = ["ink", "accent", "accent2", "warn"];
const MIN_RATIO = 3;

for (const [skinId, skin] of Object.entries(SKINS)) {
  const bg = parseColor(skin.bg);
  for (const role of ROLES) {
    const fg = compositeOverBg(skin[role], skin.bg);
    const ratio = contrastRatio(fg, bg);
    assert(
      ratio >= MIN_RATIO,
      `${skinId}.${role} (${skin[role]}) contrasta ${ratio.toFixed(2)}:1 contra bg, se requiere ${MIN_RATIO}:1`,
    );
    console.log(`${skinId}.${role.padEnd(8)} ${ratio.toFixed(2)}:1 OK`);
  }
}

console.log("Todas las skins cumplen el contraste mínimo.");
