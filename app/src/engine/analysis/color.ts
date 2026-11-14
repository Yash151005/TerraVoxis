/** sRGB (D65) to CIELAB. Mirrors pipeline/colour.py. */

const XN = 0.95047;
const YN = 1.0;
const ZN = 1.08883;
const EPS = 216 / 24389;
const KAPPA = 24389 / 27;

const LINEAR = new Float64Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  LINEAR[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

const linear = (v: number) => {
  if (Number.isInteger(v) && v >= 0 && v <= 255) return LINEAR[v];
  const c = Math.min(255, Math.max(0, v)) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const f = (t: number) => (t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116);

export type Lab = [number, number, number];

export function srgbToLab(r: number, g: number, b: number): Lab {
  const R = linear(r);
  const G = linear(g);
  const B = linear(b);
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / XN;
  const y = (0.2126729 * R + 0.7151522 * G + 0.072175 * B) / YN;
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / ZN;
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export const chroma = (lab: Lab) => Math.hypot(lab[1], lab[2]);

/** Hue angle in degrees, 0..360. */
export const hue = (lab: Lab) => {
  const h = (Math.atan2(lab[2], lab[1]) * 180) / Math.PI;
  return h < 0 ? h + 360 : h;
};

/** Index of a quantised colour cell: 5 bits per channel. */
export const cellIndex = (r: number, g: number, b: number) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

/** Centre colour of a quantised cell. */
export const cellColour = (cell: number): [number, number, number] => [
  ((cell >> 10) & 31) * 8 + 4,
  ((cell >> 5) & 31) * 8 + 4,
  (cell & 31) * 8 + 4,
];

export const CELLS = 32 * 32 * 32;
