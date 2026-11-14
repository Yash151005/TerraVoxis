import { describe, expect, it } from 'vitest';
import { createAnalysisContext, extractFeatures } from '../../src/engine/analysis/features';
import { detectEvents } from '../../src/engine/analysis/events';
import { scanBand, scanPosition } from '../../src/engine/analysis/scan';
import type { Scene } from '../../src/scenes/types';
import { image, rng, sceneById, setPx } from './helpers';

const GREY: [number, number, number] = [40, 40, 40];
const YELLOW: [number, number, number] = [230, 200, 30];

describe('event detection on synthetic flashes', () => {
  it('precision and recall are at least 0.9 over 200 random frames', () => {
    const scene: Scene = sceneById('lightning');
    const { width: W, height: H } = scene.analysis;
    const ctx = createAnalysisContext(scene, null);
    const [gw, gh] = scene.events!.grid;
    const r = rng(7);
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (let frame = 0; frame < 200; frame++) {
      const prev = image(W, H, GREY);
      const now = image(W, H, GREY);
      // Old dots, lit in both frames, must not count.
      for (let k = 0; k < 15; k++) {
        const x = Math.floor(r() * (W - 2));
        const y = Math.floor(r() * (H - 2));
        for (const img of [prev, now]) setPx(img, x, y, YELLOW);
      }
      // New flashes: 2x2 blobs in distinct grid cells.
      const truth: { cx: number; cy: number }[] = [];
      const used = new Set<number>();
      const count = 1 + Math.floor(r() * 10);
      while (truth.length < count) {
        const cx = Math.floor(r() * gw);
        const cy = Math.floor(r() * gh);
        if (used.has(cy * gw + cx)) continue;
        used.add(cy * gw + cx);
        const x0 = Math.floor(((cx + 0.3) * W) / gw);
        const y0 = Math.floor(((cy + 0.3) * H) / gh);
        let fresh = true;
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
          const i = ((y0 + dy) * W + x0 + dx) * 4;
          if (prev.data[i] === YELLOW[0]) fresh = false;
        }
        if (!fresh) continue;
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) setPx(now, x0 + dx, y0 + dy, YELLOW);
        truth.push({ cx, cy });
      }
      const a = extractFeatures(prev, null, ctx, [], 0);
      const b = extractFeatures(now, a.prev, ctx, [], 0.05);
      const matched = new Set<number>();
      for (const e of b.features.events) {
        const cx = Math.min(gw - 1, Math.floor(e.x * gw));
        const cy = Math.min(gh - 1, Math.floor(e.y * gh));
        const hit = truth.findIndex((t, i) => !matched.has(i) && t.cx === cx && t.cy === cy);
        if (hit >= 0) {
          matched.add(hit);
          tp++;
        } else fp++;
      }
      fn += truth.length - matched.size;
    }
    const precision = tp / (tp + fp);
    const recall = tp / (tp + fn);
    expect(precision).toBeGreaterThanOrEqual(0.9);
    expect(recall).toBeGreaterThanOrEqual(0.9);
  });

  it('never returns more than maxPerFrame events, strongest first', () => {
    const W = 96;
    const H = 48;
    const cfg = { hueMin: 0, hueMax: 360, minChroma: 0, minLightness: 0, grid: [48, 24] as [number, number], maxPerFrame: 12 };
    const lit = new Uint8Array(W * H);
    const prev = new Uint8Array(W * H);
    const r = rng(3);
    for (let i = 0; i < W * H; i++) lit[i] = r() < 0.2 ? 1 : 0;
    const events = detectEvents(lit, prev, W, H, cfg);
    expect(events.length).toBe(12);
    for (let i = 1; i < events.length; i++) expect(events[i - 1].strength).toBeGreaterThanOrEqual(events[i].strength);
    expect(detectEvents(lit, null, W, H, cfg)).toEqual([]);
  });
});

describe('scan mode', () => {
  it('moves the playhead from 0 to 1 over the duration, then stops', () => {
    expect(scanPosition(0, 24)).toBe(0);
    expect(scanPosition(12, 24)).toBe(0.5);
    expect(scanPosition(30, 24)).toBe(1);
  });
  it('uses a band 3% of the width centred on the playhead', () => {
    const [x0, x1] = scanBand(0.5, 200);
    expect(x1 - x0).toBe(6);
    expect((x0 + x1) / 2).toBe(100);
    const [a, b] = scanBand(0, 200);
    expect(a).toBe(0);
    expect(b).toBeGreaterThan(0);
  });
  it('computes class fractions in the band only', () => {
    const scene = sceneById('aerosols');
    const W = 100;
    const H = 20;
    const s: Scene = { ...scene, analysis: { width: W, height: H } };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lut = JSON.parse(require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../../public/luts/aerosols.json'), 'utf8'));
    const ctx = createAnalysisContext(s, lut);
    const img = image(W, H, [0, 0, 0]);
    const dust = lut.classes.find((c: { id: string }) => c.id === 'dust').rgb[0];
    const salt = lut.classes.find((c: { id: string }) => c.id === 'seaSalt').rgb[0];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) setPx(img, x, y, x < 50 ? dust : salt);
    const left = extractFeatures(img, null, ctx, [], 0, 0.2).features.global.classFractions!;
    const right = extractFeatures(img, null, ctx, [], 0, 0.8).features.global.classFractions!;
    expect(left.dust).toBeCloseTo(1, 5);
    expect(right.seaSalt).toBeCloseTo(1, 5);
  });
});
