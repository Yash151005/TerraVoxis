import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Lut, Manifest, Scene } from '../../src/scenes/types';
import type { PixelImage } from '../../src/engine/analysis/features';

const pub = resolve(__dirname, '../../public');

export const realManifest = (): Manifest => JSON.parse(readFileSync(resolve(pub, 'scenes/manifest.json'), 'utf8'));
export const realLut = (id: string): Lut => JSON.parse(readFileSync(resolve(pub, `luts/${id}.json`), 'utf8'));
export const sceneById = (id: string): Scene => realManifest().scenes.find((s) => s.id === id)!;

export function image(w: number, h: number, fill: [number, number, number] = [0, 0, 0]): PixelImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = fill[0];
    data[i * 4 + 1] = fill[1];
    data[i * 4 + 2] = fill[2];
    data[i * 4 + 3] = 255;
  }
  return { data, width: w, height: h };
}

export function setPx(img: PixelImage, x: number, y: number, c: [number, number, number]) {
  const i = (y * img.width + x) * 4;
  img.data[i] = c[0];
  img.data[i + 1] = c[1];
  img.data[i + 2] = c[2];
}

/** Colour of the LUT at fractional position u, linearly interpolated. */
export function lutColour(rgb: [number, number, number][], u: number): [number, number, number] {
  const x = u * (rgb.length - 1);
  const i = Math.min(rgb.length - 2, Math.floor(x));
  const f = x - i;
  return [0, 1, 2].map((k) => Math.round(rgb[i][k] * (1 - f) + rgb[i + 1][k] * f)) as [number, number, number];
}

/** Seeded random for reproducible tests. */
export function rng(seed = 42) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function spearman(a: number[], b: number[]) {
  const rank = (v: number[]) => {
    const idx = v.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]);
    const r = new Array<number>(v.length);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2;
      i = j + 1;
    }
    return r;
  };
  const ra = rank(a);
  const rb = rank(b);
  const n = a.length;
  const ma = ra.reduce((s, x) => s + x, 0) / n;
  const mb = rb.reduce((s, x) => s + x, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}
