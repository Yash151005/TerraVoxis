import { describe, expect, it } from 'vitest';
import { cellIndex } from '../../src/engine/analysis/color';
import { createAnalysisContext, extractFeatures, probeFeatures, pixelPass } from '../../src/engine/analysis/features';
import { createInverter, INVALID } from '../../src/engine/analysis/lut';
import type { ContinuousLut, Scene } from '../../src/scenes/types';
import { image, lutColour, realLut, rng, sceneById, setPx } from './helpers';

/** A synthetic perceptual ramp (dark purple -> teal -> yellow), like viridis. */
function viridisLike(): ContinuousLut {
  const keys: [number, number, number][] = [
    [68, 1, 84],
    [59, 82, 139],
    [33, 145, 140],
    [94, 201, 98],
    [253, 231, 37],
  ];
  const rgb = Array.from({ length: 256 }, (_, i) => lutColour(keys, i / 255));
  return { kind: 'continuous', n: 256, vmin: 0, vmax: 1, rgb };
}

function invertU(inv: ReturnType<typeof createInverter>, c: [number, number, number]): number | null {
  const k = inv.index[cellIndex(c[0], c[1], c[2])];
  return k === INVALID ? null : k / (inv.n - 1);
}

describe('colour-to-value inversion', () => {
  it('lab: mean absolute error of u below 0.02 on a synthetic gradient', () => {
    const lut = viridisLike();
    const inv = createInverter(lut, { method: 'lab', minChroma: 0, maxDistance: 20 });
    const r = rng(1);
    let err = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      const u = r();
      const got = invertU(inv, lutColour(lut.rgb, u));
      expect(got).not.toBeNull();
      err += Math.abs(got! - u);
    }
    expect(err / N).toBeLessThan(0.02);
  });

  it('hue: mean absolute error of u below 0.05 with lightness scaled by 0.5 to 1.0 (real ocean legend)', () => {
    const lut = realLut('ocean') as ContinuousLut;
    const inv = createInverter(lut, sceneById('ocean').match);
    const r = rng(2);
    let err = 0;
    let n = 0;
    let invalid = 0;
    for (let i = 0; i < 2000; i++) {
      const u = r();
      const k = 0.5 + 0.5 * r();
      const c = lutColour(lut.rgb, u).map((v) => Math.round(v * k)) as [number, number, number];
      const got = invertU(inv, c);
      if (got === null) {
        invalid++;
        continue;
      }
      err += Math.abs(got - u);
      n++;
    }
    expect(invalid / 2000).toBeLessThan(0.05);
    expect(err / n).toBeLessThan(0.05);
  });

  it('hue: grey pixels are invalid', () => {
    const inv = createInverter(realLut('ocean'), sceneById('ocean').match);
    for (const g of [20, 64, 100, 128, 180, 230]) expect(invertU(inv, [g, g, g])).toBeNull();
    expect(invertU(inv, [90, 92, 88])).toBeNull(); // land grey, slightly tinted
  });

  it('categorical: legend swatches map to their class; dimmed copies never map to another class', () => {
    const lut = realLut('aerosols');
    if (lut.kind !== 'categorical') throw new Error('expected categorical');
    const inv = createInverter(lut, sceneById('aerosols').match);
    lut.classes.forEach((c, k) => {
      expect(inv.index[cellIndex(c.rgb[0][0], c.rgb[0][1], c.rgb[0][2])]).toBe(k);
      // Very dim copies may fall below minChroma (grey) and be invalid, but must not be misread.
      for (const s of c.rgb) expect([k, INVALID]).toContain(inv.index[cellIndex(s[0], s[1], s[2])]);
    });
  });

  it('masked pixels are excluded', () => {
    const base = sceneById('ocean');
    const scene: Scene = { ...base, analysis: { width: 20, height: 10 }, masks: [{ x: 0, y: 0, w: 0.5, h: 1 }] };
    const lut = realLut('ocean') as ContinuousLut;
    const ctx = createAnalysisContext(scene, lut);
    // Left half (masked) is red = 32 C; right half is blue = 0 C.
    const img = image(20, 10, lut.rgb[0]);
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) setPx(img, x, y, lut.rgb[255]);
    const { features } = extractFeatures(img, null, ctx, [{ x: 0.5, y: 0.5, r: 0.5 }], 0);
    expect(features.global.u).toBeLessThan(0.05);
    expect(features.global.coverage).toBeCloseTo(1, 5);
    expect(features.probes[0].u).toBeLessThan(0.05);
  });

  it('probe value is null below 15% coverage and present above it', () => {
    const scene: Scene = { ...sceneById('ocean'), analysis: { width: 40, height: 40 } };
    const lut = realLut('ocean') as ContinuousLut;
    const ctx = createAnalysisContext(scene, lut);
    const probe = { x: 0.5, y: 0.5, r: 0.25 }; // radius 10 px
    const make = (fraction: number) => {
      const img = image(40, 40, [100, 100, 100]); // grey land
      // Fill the first `fraction` of the disc's rows with mid-scale colour.
      const col = lutColour(lut.rgb, 0.5);
      const pass = { n: 0 };
      for (let y = 0; y < 40; y++)
        for (let x = 0; x < 40; x++) {
          const inside = (x + 0.5 - 20) ** 2 + (y + 0.5 - 20) ** 2 <= 100;
          if (inside && (y - 10) / 20 < fraction) {
            setPx(img, x, y, col);
            pass.n++;
          }
        }
      return probeFeatures(probe, pixelPass(img, ctx), null, ctx);
    };
    const low = make(0.08);
    expect(low.coverage).toBeLessThan(0.15);
    expect(low.value).toBeNull();
    expect(low.u).toBeNull();
    const ok = make(0.5);
    expect(ok.coverage).toBeGreaterThan(0.15);
    expect(ok.value).not.toBeNull();
    expect(ok.value!).toBeGreaterThan(14);
    expect(ok.value!).toBeLessThan(18);
  });

  it('reports spread and confidence', () => {
    const scene: Scene = { ...sceneById('ocean'), analysis: { width: 20, height: 20 } };
    const lut = realLut('ocean') as ContinuousLut;
    const ctx = createAnalysisContext(scene, lut);
    const flat = image(20, 20, lutColour(lut.rgb, 0.5));
    const f1 = probeFeatures({ x: 0.5, y: 0.5, r: 0.4 }, pixelPass(flat, ctx), null, ctx);
    expect(f1.spread).toBeLessThan(0.02);
    expect(f1.confidence).toBeGreaterThan(0.6);
    const mixed = image(20, 20, lut.rgb[0]);
    for (let y = 0; y < 20; y++) for (let x = 10; x < 20; x++) setPx(mixed, x, y, lut.rgb[255]);
    const f2 = probeFeatures({ x: 0.5, y: 0.5, r: 0.4 }, pixelPass(mixed, ctx), null, ctx);
    expect(f2.spread).toBeGreaterThan(0.4);
  });

  it('motion is the mean lightness change divided by 20', () => {
    const scene: Scene = { ...sceneById('ocean'), analysis: { width: 10, height: 10 } };
    const ctx = createAnalysisContext(scene, realLut('ocean'));
    const a = image(10, 10, [0, 0, 0]);
    const b = image(10, 10, [48, 48, 48]); // L about 20
    const first = extractFeatures(a, null, ctx, [], 0);
    expect(first.features.global.motion).toBe(0);
    const second = extractFeatures(b, first.prev, ctx, [], 0.05);
    expect(second.features.global.motion).toBeGreaterThan(0.9);
  });
});
