import type { FrameFeatures, GlobalFeatures, ProbeFeatures } from '../types';

/** One-pole smoothing step: y += (x - y) * (1 - exp(-dt / tau)). */
export function onePole(y: number, x: number, dt: number, tau: number) {
  if (tau <= 0) return x;
  return y + (x - y) * (1 - Math.exp(-dt / tau));
}

const sm = (prev: number | null | undefined, x: number | null, dt: number, tau: number): number | null => {
  if (x === null) return null;
  if (prev === null || prev === undefined) return x; // null -> number: jump, do not glide
  return onePole(prev, x, dt, tau);
};

const smN = (prev: number | undefined, x: number, dt: number, tau: number) =>
  prev === undefined ? x : onePole(prev, x, dt, tau);

function smoothFractions(prev: Record<string, number> | undefined, x: Record<string, number> | undefined, dt: number, tau: number) {
  if (!x) return undefined;
  const out: Record<string, number> = {};
  for (const k of Object.keys(x)) out[k] = smN(prev?.[k], x[k], dt, tau);
  return out;
}

/**
 * Section 7.8. Smooths u, coverage, spread and motion (and class fractions) of the global
 * region and of each probe. Events are passed through. Reset on seek.
 */
export class FeatureSmoother {
  private prev: FrameFeatures | null = null;
  tau: number;

  constructor(tau = 0.15) {
    this.tau = tau;
  }

  reset() {
    this.prev = null;
  }

  step(f: FrameFeatures, dtOverride?: number): FrameFeatures {
    const p = this.prev;
    if (!p) {
      this.prev = structuredCloneFeatures(f);
      return this.prev;
    }
    const dt = Math.max(0, dtOverride ?? f.t - p.t);
    const tau = this.tau;
    const global: GlobalFeatures = {
      u: sm(p.global.u, f.global.u, dt, tau),
      coverage: smN(p.global.coverage, f.global.coverage, dt, tau),
      motion: smN(p.global.motion, f.global.motion, dt, tau),
      spread: smN(p.global.spread, f.global.spread, dt, tau),
      classFractions: smoothFractions(p.global.classFractions, f.global.classFractions, dt, tau),
    };
    const probes: ProbeFeatures[] = f.probes.map((q, i) => {
      const pq = p.probes[i];
      // A probe that moved a long way starts afresh rather than gliding from its old place.
      const fresh = !pq || Math.hypot(pq.x - q.x, pq.y - q.y) > 0.2;
      if (fresh) return { ...q, classFractions: q.classFractions && { ...q.classFractions } };
      const u = sm(pq.u, q.u, dt, tau);
      return {
        ...q,
        u,
        value: u === null ? null : q.value, // recomputed from smoothed u by valuesFromU
        coverage: smN(pq.coverage, q.coverage, dt, tau),
        spread: smN(pq.spread, q.spread, dt, tau),
        motion: smN(pq.motion, q.motion, dt, tau),
        classFractions: smoothFractions(pq.classFractions, q.classFractions, dt, tau),
      };
    });
    const out: FrameFeatures = { ...f, global, probes, events: f.events };
    this.prev = out;
    return out;
  }
}

/** Recompute values from smoothed u. */
export function valuesFromU(f: FrameFeatures, vmin: number, vmax: number, continuous: boolean): FrameFeatures {
  if (!continuous) return f;
  return {
    ...f,
    probes: f.probes.map((p) => ({ ...p, value: p.u === null ? null : vmin + p.u * (vmax - vmin) })),
  };
}

function structuredCloneFeatures(f: FrameFeatures): FrameFeatures {
  return {
    ...f,
    global: { ...f.global, classFractions: f.global.classFractions && { ...f.global.classFractions } },
    probes: f.probes.map((p) => ({ ...p, classFractions: p.classFractions && { ...p.classFractions } })),
    events: f.events.slice(),
  };
}
