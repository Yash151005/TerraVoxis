import { describe, expect, it } from 'vitest';
import { BAND_MIN_GAP_MS, EVENT_MIN_GAP_MS, HapticPlanner, bandOf, pulses } from '../../src/engine/haptics/haptics';
import type { FrameFeatures } from '../../src/engine/types';

function frame(u: number | null): FrameFeatures {
  return {
    t: 0,
    global: { u, coverage: 1, motion: 0, spread: 0 },
    probes: [{ x: 0.5, y: 0.5, r: 0.05, value: u, u, coverage: 1, spread: 0, motion: 0, confidence: 1 }],
    events: [],
  };
}

describe('haptics', () => {
  it('maps u to quarters with hysteresis', () => {
    expect(bandOf(0.1, null)).toBe(0);
    expect(bandOf(0.9, null)).toBe(3);
    expect(bandOf(0.26, 0)).toBe(0); // just over the edge: stays
    expect(bandOf(0.3, 0)).toBe(1);
    expect(bandOf(1.4, null)).toBe(3);
  });

  it('pulse count encodes the band', () => {
    expect(pulses(1)).toEqual([40]);
    expect(pulses(3)).toEqual([40, 60, 40, 60, 40]);
  });

  it('first reading is silent, band change pulses, then throttles', () => {
    const h = new HapticPlanner();
    expect(h.step(frame(0.1), 0, 0)).toBeNull();
    expect(h.step(frame(0.1), 0, 100)).toBeNull();
    expect(h.step(frame(0.6), 0, 200)).toEqual(pulses(3));
    expect(h.step(frame(0.9), 0, 200 + BAND_MIN_GAP_MS - 1)).toBeNull();
    expect(h.step(frame(0.9), 0, 200 + BAND_MIN_GAP_MS)).toEqual(pulses(4));
  });

  it('taps for events, throttled', () => {
    const h = new HapticPlanner();
    expect(h.step(frame(null), 2, 0)).toEqual([40]);
    expect(h.step(frame(null), 2, EVENT_MIN_GAP_MS - 1)).toBeNull();
    expect(h.step(frame(null), 10, EVENT_MIN_GAP_MS)).toEqual([80]);
  });
});
