import { Color } from "three";

const FALLBACK_NEUTRAL: [number, number, number] = [0.48, 0.52, 0.58];

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function srgbToLinear(value: number) {
  if (value <= 0.04045) {
    return value / 12.92;
  }
  return ((value + 0.055) / 1.055) ** 2.4;
}

function oklchToLinearRgb(oklch: string): [number, number, number] | null {
  const match = oklch.match(/oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)(?:deg)?\s*\)/i);
  if (!match) {
    return null;
  }

  const lightness = Number(match[1]);
  const chroma = Number(match[2]);
  const hue = (Number(match[3]) * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);

  const l_ = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = lightness - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const sr = clamp01(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const sg = clamp01(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const sb = clamp01(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);

  return [srgbToLinear(sr), srgbToLinear(sg), srgbToLinear(sb)];
}

function readToken(tokenName: string) {
  if (typeof document === "undefined") {
    return "";
  }
  return getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim();
}

export function getTokenColor(tokenName: string): [number, number, number] {
  const cssValue = readToken(tokenName);
  if (!cssValue) {
    return FALLBACK_NEUTRAL;
  }

  try {
    const color = new Color();
    color.setStyle(cssValue);
    return [color.r, color.g, color.b];
  } catch {
    return oklchToLinearRgb(cssValue) ?? FALLBACK_NEUTRAL;
  }
}

export const NEUTRAL_BASE = getTokenColor("--muted-foreground");
