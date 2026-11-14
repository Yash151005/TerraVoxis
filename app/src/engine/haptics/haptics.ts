import type { FrameFeatures } from '../types';

/**
 * Tactile feedback (Vibration API). Two cues, both opt-in and only while playing:
 *  - Value bands: probe 1's normalised value u is split into BANDS equal bands. Entering a new band
 *    gives (band + 1) short pulses, so the count tells you roughly where you are: 1 = lowest, 4 = highest.
 *  - Events: new lightning (or other scene events) give one short tap, longer when there are many.
 * Hysteresis and throttling keep it from buzzing continuously on noisy values.
 */
export const BANDS = 4;
export const HYSTERESIS = 0.03;
export const BAND_MIN_GAP_MS = 400;
export const EVENT_MIN_GAP_MS = 150;

const PULSE_MS = 40;
const GAP_MS = 60;

export class HapticPlanner {
  private band: number | null = null;
  private lastBandAt = -Infinity;
  private lastEventAt = -Infinity;

  reset() {
    this.band = null;
    this.lastBandAt = -Infinity;
    this.lastEventAt = -Infinity;
  }

  /** Returns a vibration pattern to play now, or null. */
  step(f: FrameFeatures, newEvents: number, now: number): number[] | null {
    const u = f.probes[0]?.u ?? null;
    if (u !== null) {
      const b = bandOf(u, this.band);
      if (this.band === null) {
        this.band = b; // first reading sets the baseline silently
      } else if (b !== this.band && now - this.lastBandAt >= BAND_MIN_GAP_MS) {
        this.band = b;
        this.lastBandAt = now;
        return pulses(b + 1);
      }
    }
    if (newEvents > 0 && now - this.lastEventAt >= EVENT_MIN_GAP_MS) {
      this.lastEventAt = now;
      return [Math.min(80, 20 + newEvents * 10)];
    }
    return null;
  }
}

/** Band index for u, staying in the current band until u is clearly past its edge. */
export function bandOf(u: number, current: number | null): number {
  const clamped = Math.min(1, Math.max(0, u));
  const raw = Math.min(BANDS - 1, Math.floor(clamped * BANDS));
  if (current === null || raw === current) return raw;
  const lo = current / BANDS - HYSTERESIS;
  const hi = (current + 1) / BANDS + HYSTERESIS;
  return clamped >= lo && clamped <= hi ? current : raw;
}

export function pulses(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i) out.push(GAP_MS);
    out.push(PULSE_MS);
  }
  return out;
}

export function hapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function vibrate(pattern: number[]): void {
  if (hapticsSupported()) navigator.vibrate(pattern);
}
