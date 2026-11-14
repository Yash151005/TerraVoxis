import type { Lut, ProbeSpec, Rect, Scene } from '../../scenes/types';
import type { FrameFeatures, GlobalFeatures, ProbeFeatures } from '../types';
import { cellIndex } from './color';
import { detectEvents } from './events';
import { createInverter, createLitTable, INVALID, type Inverter } from './lut';
import { scanBand } from './scan';

export const MIN_COVERAGE = 0.15;
export const MOTION_SCALE = 20;
/** Event scenes: share of lit pixels that counts as full activity. */
export const EVENT_ACTIVITY_FULL = 0.04;

export type PixelImage = { data: Uint8ClampedArray | Uint8Array; width: number; height: number };

export type AnalysisContext = {
  scene: Pick<Scene, 'quantity' | 'match' | 'events'>;
  inverter: Inverter;
  litTable: Uint8Array | null;
  mask: Uint8Array | null;
  width: number;
  height: number;
};

export function buildMask(masks: Rect[], width: number, height: number): Uint8Array | null {
  if (!masks.length) return null;
  const m = new Uint8Array(width * height);
  for (const r of masks) {
    const x0 = Math.max(0, Math.floor(r.x * width));
    const x1 = Math.min(width, Math.ceil((r.x + r.w) * width));
    const y0 = Math.max(0, Math.floor(r.y * height));
    const y1 = Math.min(height, Math.ceil((r.y + r.h) * height));
    for (let y = y0; y < y1; y++) m.fill(1, y * width + x0, y * width + x1);
  }
  return m;
}

export function createAnalysisContext(scene: Scene, lut: Lut | null): AnalysisContext {
  const { width, height } = scene.analysis;
  return {
    scene,
    inverter: createInverter(lut, scene.match),
    litTable: scene.events ? createLitTable(scene.events) : null,
    mask: buildMask(scene.masks, width, height),
    width,
    height,
  };
}

/** Per-pixel results of one frame; reused by region statistics. */
export type PixelPass = {
  /** Lookup index or class, INVALID when not a data colour. */
  index: Uint16Array;
  confidence: Float32Array;
  lightness: Float32Array;
  lit: Uint8Array | null;
};

export function pixelPass(img: PixelImage, ctx: AnalysisContext): PixelPass {
  const n = img.width * img.height;
  const index = new Uint16Array(n);
  const confidence = new Float32Array(n);
  const lightness = new Float32Array(n);
  const lit = ctx.litTable ? new Uint8Array(n) : null;
  const { inverter, litTable, mask } = ctx;
  const d = img.data;
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const cell = cellIndex(d[j], d[j + 1], d[j + 2]);
    lightness[i] = inverter.lightness[cell];
    if (mask && mask[i]) {
      index[i] = INVALID;
      continue;
    }
    index[i] = inverter.index[cell];
    confidence[i] = inverter.confidence[cell];
    if (lit && litTable) lit[i] = litTable[cell];
  }
  return { index, confidence, lightness, lit };
}

type RegionStats = {
  total: number;
  valid: number;
  wSum: number;
  wuSum: number;
  uSum: number;
  u2Sum: number;
  confSum: number;
  motionSum: number;
  motionN: number;
  litN: number;
  classCounts: Float64Array;
};

const emptyStats = (nClasses: number): RegionStats => ({
  total: 0,
  valid: 0,
  wSum: 0,
  wuSum: 0,
  uSum: 0,
  u2Sum: 0,
  confSum: 0,
  motionSum: 0,
  motionN: 0,
  litN: 0,
  classCounts: new Float64Array(nClasses),
});

function accumulate(s: RegionStats, i: number, pass: PixelPass, prevL: Float32Array | null, ctx: AnalysisContext, mask: Uint8Array | null) {
  if (mask && mask[i]) return;
  s.total++;
  if (prevL) {
    s.motionSum += Math.abs(pass.lightness[i] - prevL[i]);
    s.motionN++;
  }
  if (pass.lit && pass.lit[i]) s.litN++;
  const k = pass.index[i];
  if (k === INVALID) return;
  s.valid++;
  const c = pass.confidence[i];
  s.confSum += c;
  if (ctx.inverter.method === 'categorical') {
    s.classCounts[k]++;
    return;
  }
  const u = k / (ctx.inverter.n - 1);
  // Weight by confidence; a tiny floor keeps edge-of-threshold pixels from vanishing entirely.
  const w = Math.max(c, 1e-3);
  s.wSum += w;
  s.wuSum += w * u;
  s.uSum += u;
  s.u2Sum += u * u;
}

type Summary = {
  u: number | null;
  coverage: number;
  spread: number;
  motion: number;
  confidence: number;
  classFractions?: Record<string, number>;
  litFraction: number;
};

function summarise(s: RegionStats, ctx: AnalysisContext): Summary {
  const coverage = s.total ? s.valid / s.total : 0;
  const motion = s.motionN ? Math.min(1, s.motionSum / s.motionN / MOTION_SCALE) : 0;
  const litFraction = s.total ? s.litN / s.total : 0;
  const meanConf = s.valid ? s.confSum / s.valid : 0;
  const confidence = meanConf * Math.min(1, coverage / 0.5);
  const kind = ctx.scene.quantity.kind;
  if (kind === 'event') {
    const activity = Math.min(1, litFraction / EVENT_ACTIVITY_FULL);
    return { u: activity, coverage: 1, spread: 0, motion, confidence: 1, litFraction };
  }
  if (kind === 'categorical') {
    const classFractions: Record<string, number> = {};
    ctx.inverter.classIds.forEach((id, k) => {
      classFractions[id] = s.total ? s.classCounts[k] / s.total : 0;
    });
    return { u: null, coverage, spread: 0, motion, confidence, classFractions, litFraction };
  }
  if (coverage < MIN_COVERAGE || s.valid === 0) {
    return { u: null, coverage, spread: 0, motion, confidence, litFraction };
  }
  const mean = s.uSum / s.valid;
  const spread = Math.sqrt(Math.max(0, s.u2Sum / s.valid - mean * mean));
  return { u: s.wuSum / s.wSum, coverage, spread, motion, confidence, litFraction };
}

/** Section 7.4: statistics over the disc of a probe. Radius r is a fraction of image width. */
export function probeFeatures(
  probe: ProbeSpec,
  pass: PixelPass,
  prevL: Float32Array | null,
  ctx: AnalysisContext,
): ProbeFeatures {
  const { width: w, height: h } = ctx;
  const s = emptyStats(ctx.inverter.n);
  const rad = Math.max(1.5, probe.r * w);
  const cx = probe.x * w;
  const cy = probe.y * h;
  const y0 = Math.max(0, Math.floor(cy - rad));
  const y1 = Math.min(h - 1, Math.ceil(cy + rad));
  const x0 = Math.max(0, Math.floor(cx - rad));
  const x1 = Math.min(w - 1, Math.ceil(cx + rad));
  const r2 = rad * rad;
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      if (dx * dx + dy * dy > r2) continue;
      accumulate(s, y * w + x, pass, prevL, ctx, ctx.mask);
    }
  }
  const sum = summarise(s, ctx);
  const q = ctx.scene.quantity;
  let value: number | null = null;
  let u = sum.u;
  if (q.kind === 'continuous' && u !== null) value = q.vmin + u * (q.vmax - q.vmin);
  if (q.kind === 'event') {
    value = sum.litFraction * 100; // share of the probe covered by lightning dots, in percent
    u = Math.min(1, sum.litFraction * 5);
  }
  return {
    x: probe.x,
    y: probe.y,
    r: probe.r,
    value,
    u,
    coverage: sum.coverage,
    spread: sum.spread,
    motion: sum.motion,
    confidence: sum.confidence,
    ...(sum.classFractions ? { classFractions: sum.classFractions } : {}),
  };
}

/** Section 7.5 / 7.6: statistics over the whole frame, or over the scan band. */
export function regionFeatures(
  pass: PixelPass,
  prevL: Float32Array | null,
  ctx: AnalysisContext,
  scanX?: number,
): GlobalFeatures {
  const { width: w, height: h } = ctx;
  const [x0, x1] = scanX === undefined ? [0, w] : scanBand(scanX, w);
  const s = emptyStats(ctx.inverter.n);
  for (let y = 0; y < h; y++) {
    for (let x = x0; x < x1; x++) accumulate(s, y * w + x, pass, prevL, ctx, ctx.mask);
  }
  const sum = summarise(s, ctx);
  return {
    u: sum.u,
    coverage: sum.coverage,
    motion: sum.motion,
    spread: sum.spread,
    ...(sum.classFractions ? { classFractions: sum.classFractions } : {}),
  };
}

export type PrevFrame = { lightness: Float32Array; lit: Uint8Array | null } | null;

/**
 * Section 7: pixels to features. Pure: returns the features and the buffers to pass as
 * `prev` next time.
 */
export function extractFeatures(
  img: PixelImage,
  prev: PrevFrame,
  ctx: AnalysisContext,
  probes: ProbeSpec[],
  t: number,
  scanX?: number,
): { features: FrameFeatures; prev: NonNullable<PrevFrame> } {
  if (img.width !== ctx.width || img.height !== ctx.height) {
    throw new Error(`Frame is ${img.width}x${img.height}; analysis expects ${ctx.width}x${ctx.height}`);
  }
  const pass = pixelPass(img, ctx);
  const prevL = prev?.lightness ?? null;
  const global = regionFeatures(pass, prevL, ctx, scanX);
  const probeOut = probes.map((p) => probeFeatures(p, pass, prevL, ctx));
  const events =
    ctx.scene.events && pass.lit
      ? detectEvents(pass.lit, prev?.lit ?? null, ctx.width, ctx.height, ctx.scene.events, ctx.mask)
      : [];
  const features: FrameFeatures = { t, global, probes: probeOut, events };
  if (scanX !== undefined) features.scanX = scanX;
  return { features, prev: { lightness: pass.lightness, lit: pass.lit } };
}

/** Stateful convenience wrapper used by live playback and export. */
export class Analyzer {
  readonly ctx: AnalysisContext;
  private prev: PrevFrame = null;
  constructor(ctx: AnalysisContext) {
    this.ctx = ctx;
  }
  reset() {
    this.prev = null;
  }
  analyse(img: PixelImage, probes: ProbeSpec[], t: number, scanX?: number): FrameFeatures {
    const { features, prev } = extractFeatures(img, this.prev, this.ctx, probes, t, scanX);
    this.prev = prev;
    return features;
  }
}
