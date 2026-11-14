import { describe, expect, it } from 'vitest';
import { F_MAX, F_MIN } from '../../src/engine/mapping/constants';
import { eventFreq, initialMappingState, mapFeatures, scientificFreq } from '../../src/engine/mapping/mapFeatures';
import { defaultModeConfig, type ModeName } from '../../src/engine/mapping/modes';
import { freqToMidi, inScale } from '../../src/engine/mapping/scales';
import type { FrameFeatures } from '../../src/engine/types';
import { sceneById, spearman } from './helpers';

const ocean = sceneById('ocean');
const lightning = sceneById('lightning');
const aerosols = sceneById('aerosols');

const frame = (t: number, u: number | null, extra: Partial<FrameFeatures> = {}): FrameFeatures => ({
  t,
  global: { u, coverage: 1, motion: 0, spread: 0 },
  probes: [{ x: 0.3, y: 0.4, r: 0.03, u, value: null, coverage: 1, spread: 0, motion: 0, confidence: 1 }],
  events: [],
  ...extra,
});

/** Probe frequency for each u in 0..1 (100 steps), running the mapping as a stream. */
function sweep(mode: ModeName, polarity: 1 | -1 = 1) {
  const cfg = { ...defaultModeConfig(mode), polarity };
  const us: number[] = [];
  const fs: number[] = [];
  for (let i = 0; i <= 100; i++) {
    const u = i / 100;
    // A fresh state per point: we test the mapping, not the note hysteresis.
    const r = mapFeatures(frame(i, u), ocean, cfg, initialMappingState());
    us.push(u);
    fs.push(r.targets.probe[0].freq);
  }
  return { us, fs };
}

describe('pitch mapping', () => {
  it.each(['scientific', 'musical', 'accessibility'] as ModeName[])('%s: frequency never decreases as u rises; rank correlation > 0.98', (mode) => {
    const { us, fs } = sweep(mode);
    for (let i = 1; i < fs.length; i++) expect(fs[i]).toBeGreaterThanOrEqual(fs[i - 1]);
    expect(spearman(us, fs)).toBeGreaterThan(0.98);
  });

  it.each(['scientific', 'musical', 'accessibility'] as ModeName[])('%s: polarity flip reverses the order', (mode) => {
    const up = sweep(mode, 1).fs;
    const down = sweep(mode, -1).fs;
    for (let i = 1; i < down.length; i++) expect(down[i]).toBeLessThanOrEqual(down[i - 1]);
    expect(down[0]).toBeCloseTo(up[100], 6);
    expect(down[100]).toBeCloseTo(up[0], 6);
  });

  it.each(['scientific', 'musical', 'accessibility'] as ModeName[])('%s: probe frequency stays within F_MIN and F_MAX', (mode) => {
    for (const p of [1, -1] as const) for (const f of sweep(mode, p).fs) {
      expect(f).toBeGreaterThanOrEqual(F_MIN - 1e-6);
      expect(f).toBeLessThanOrEqual(F_MAX + 1e-6);
    }
    expect(scientificFreq(-1)).toBeCloseTo(F_MIN, 6);
    expect(scientificFreq(2)).toBeCloseTo(F_MAX, 6);
  });

  it('Musical: every note belongs to the scene scale', () => {
    for (const scene of [ocean, lightning, aerosols]) {
      const cfg = defaultModeConfig('musical');
      for (let i = 0; i <= 200; i++) {
        const r = mapFeatures(frame(i, i / 200), { ...scene, streams: ['probe'], quantity: { ...scene.quantity, kind: 'continuous' } }, cfg, initialMappingState());
        const midi = Math.round(freqToMidi(r.targets.probe[0].freq));
        expect(inScale(midi, scene.musical.scale, scene.musical.root)).toBe(true);
        expect(Math.abs(freqToMidi(r.targets.probe[0].freq) - midi)).toBeLessThan(1e-6);
      }
    }
  });

  it('Musical: sustains the note for small moves and re-triggers on large ones', () => {
    const cfg = defaultModeConfig('musical');
    let state = initialMappingState();
    let r = mapFeatures(frame(0, 0.5), ocean, cfg, state);
    expect(r.targets.noteOn?.length).toBe(1);
    state = r.state;
    r = mapFeatures(frame(0.25, 0.505), ocean, cfg, state);
    expect(r.targets.noteOn).toBeUndefined();
    state = r.state;
    r = mapFeatures(frame(0.5, 0.8), ocean, cfg, state);
    expect(r.targets.noteOn?.length).toBe(1);
  });

  it('Accessibility: 8 pitch steps and alternating probes', () => {
    const { fs } = sweep('accessibility');
    expect(new Set(fs.map((f) => f.toFixed(3))).size).toBe(8);
    const cfg = defaultModeConfig('accessibility');
    const two: FrameFeatures = {
      ...frame(0.1, 0.5),
      probes: [frame(0, 0.2).probes[0], { ...frame(0, 0.8).probes[0], x: 0.7 }],
    };
    const a = mapFeatures({ ...two, t: 0.1 }, ocean, cfg, initialMappingState()).targets.probe;
    const b = mapFeatures({ ...two, t: 1.3 }, ocean, cfg, initialMappingState()).targets.probe;
    expect(a[0].gain > 0 && a[1].gain === 0).toBe(true);
    expect(b[0].gain === 0 && b[1].gain > 0).toBe(true);
  });

  it('silences the probe when u is null, and pans west left / east right', () => {
    const cfg = defaultModeConfig('scientific');
    const r = mapFeatures(frame(0, null), ocean, cfg, initialMappingState());
    expect(r.targets.probe[0].gain).toBe(0);
    const left = mapFeatures({ ...frame(0, 0.5), probes: [{ ...frame(0, 0.5).probes[0], x: 0 }] }, ocean, cfg, initialMappingState());
    const right = mapFeatures({ ...frame(0, 0.5), probes: [{ ...frame(0, 0.5).probes[0], x: 1 }] }, ocean, cfg, initialMappingState());
    expect(left.targets.probe[0].pan).toBeCloseTo(-0.9);
    expect(right.targets.probe[0].pan).toBeCloseTo(0.9);
  });

  it('bed sits one octave below the probe', () => {
    const cfg = defaultModeConfig('scientific');
    const r = mapFeatures(frame(0, 0.5), ocean, cfg, initialMappingState());
    expect(r.targets.bed.freq).toBeCloseTo(r.targets.probe[0].freq / 2, 6);
    expect(mapFeatures(frame(0, 0.5), ocean, defaultModeConfig('accessibility'), initialMappingState()).targets.bed.gain).toBe(0);
  });
});

describe('events mapping', () => {
  const many = (t: number, n: number): FrameFeatures => ({
    ...frame(t, null),
    events: Array.from({ length: n }, (_, i) => ({ x: i / n, y: 0.5, strength: (i % 6) / 6 + 0.1 })),
  });

  it('never starts more than 8 event voices within 100 ms', () => {
    const cfg = defaultModeConfig('scientific');
    let state = initialMappingState();
    const starts: number[] = [];
    for (let k = 0; k < 40; k++) {
      const t = k * 0.05;
      const r = mapFeatures(many(t, 12), lightning, cfg, state);
      state = r.state;
      r.targets.hits.forEach(() => starts.push(t));
    }
    for (const t of starts) expect(starts.filter((s) => s > t - 0.1 + 1e-9 && s <= t).length).toBeLessThanOrEqual(8);
  });

  it('keeps the strongest events and caps Accessibility mode at 4 per frame', () => {
    const r = mapFeatures(many(0, 12), lightning, defaultModeConfig('accessibility'), initialMappingState());
    expect(r.targets.hits.length).toBeLessThanOrEqual(4);
    const s = mapFeatures(many(0, 12), lightning, defaultModeConfig('scientific'), initialMappingState());
    expect(s.targets.hits.length).toBe(8);
  });

  it('pitch rises from south to north (C5 to C7) and uses three bands in Accessibility mode', () => {
    expect(eventFreq(1, lightning, 'scientific')).toBeCloseTo(523.25, 2);
    expect(eventFreq(0, lightning, 'scientific')).toBeCloseTo(2093, 0);
    const bands = new Set([0.1, 0.3, 0.45, 0.5, 0.55, 0.7, 0.9].map((y) => eventFreq(y, lightning, 'accessibility').toFixed(2)));
    expect(bands.size).toBe(3);
  });
});

describe('class voices', () => {
  it('follow class fractions; Accessibility keeps only the two largest', () => {
    const f: FrameFeatures = { ...frame(0, null), global: { u: null, coverage: 0.5, motion: 0, spread: 0, classFractions: { dust: 0.5, seaSalt: 0.2, sulfate: 0.1, blackCarbon: 0 } } };
    const s = mapFeatures(f, aerosols, defaultModeConfig('scientific'), initialMappingState()).targets.classes!;
    expect(s.dust).toBeGreaterThan(s.seaSalt);
    expect(s.seaSalt).toBeGreaterThan(s.sulfate);
    expect(s.blackCarbon).toBe(0);
    expect(s.dust).toBeCloseTo(0.4 * 0.5 ** 0.7, 6);
    const a = mapFeatures(f, aerosols, defaultModeConfig('accessibility'), initialMappingState()).targets.classes!;
    expect(a.sulfate).toBe(0);
    expect(a.dust).toBeGreaterThan(0);
    expect(a.seaSalt).toBeGreaterThan(0);
  });
});
