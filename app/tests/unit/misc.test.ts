import { describe, expect, it } from 'vitest';
import { describe as describeMoment, trendOf } from '../../src/a11y/describe';
import { splitSentences } from '../../src/a11y/speech';
import { FeatureSmoother, onePole } from '../../src/engine/analysis/smoothing';
import { legendSteps } from '../../src/engine/audio/legend';
import { buildSidecar, HONESTY_STATEMENT, SIDECAR_FIELDS } from '../../src/engine/export/sidecar';
import { decodeWavBytes, encodeWavBytes, NORMALISE_CEILING } from '../../src/engine/export/wav';
import { defaultModeConfig } from '../../src/engine/mapping/modes';
import type { FrameFeatures } from '../../src/engine/types';
import { formatLatLon, toLonLat } from '../../src/lib/geo';
import { validateLut, validateManifest } from '../../src/scenes/validate';
import { realLut, realManifest, sceneById } from './helpers';

describe('smoothing', () => {
  it('step response reaches 63% in about tau', () => {
    const tau = 0.15;
    let y = 0;
    const dt = 0.001;
    let t = 0;
    while (y < 1 - Math.exp(-1)) {
      y = onePole(y, 1, dt, tau);
      t += dt;
    }
    expect(Math.abs(t - tau)).toBeLessThan(0.005);
  });

  it('jumps from null to a number, and resets', () => {
    const s = new FeatureSmoother(0.15);
    const f = (t: number, u: number | null): FrameFeatures => ({
      t,
      global: { u, coverage: 1, motion: 0, spread: 0 },
      probes: [{ x: 0.5, y: 0.5, r: 0.03, u, value: null, coverage: 1, spread: 0, motion: 0, confidence: 1 }],
      events: [],
    });
    s.step(f(0, null));
    expect(s.step(f(0.05, 0.8)).probes[0].u).toBe(0.8);
    const glided = s.step(f(0.1, 0.2)).probes[0].u!;
    expect(glided).toBeGreaterThan(0.2);
    expect(glided).toBeLessThan(0.8);
    s.reset();
    expect(s.step(f(5, 0.1)).probes[0].u).toBe(0.1);
  });
});

describe('coordinates', () => {
  const geo = sceneById('ocean').geo!;
  it('maps corners and centre', () => {
    expect(toLonLat(0, 0, geo)).toEqual({ lon: -180, lat: 90 });
    expect(toLonLat(1, 1, geo)).toEqual({ lon: 180, lat: -90 });
    expect(toLonLat(0.5, 0.5, geo)).toEqual({ lon: 0, lat: 0 });
    expect(toLonLat(1, 0, geo)).toEqual({ lon: 180, lat: 90 });
  });
  it('formats as "35° N, 140° E"', () => {
    expect(formatLatLon(35.2, 139.7)).toBe('35° N, 140° E');
    expect(formatLatLon(-55, -50)).toBe('55° S, 50° W');
    expect(formatLatLon(0, 0)).toBe('0°, 0°');
  });
});

describe('WAV encoder', () => {
  const sr = 44100;
  const n = 1000;
  const left = Float32Array.from({ length: n }, (_, i) => 0.5 * Math.sin(i / 10));
  const right = Float32Array.from({ length: n }, (_, i) => 0.25 * Math.cos(i / 7));
  const bytes = encodeWavBytes([left, right], sr);

  it('writes a correct 44-byte header', () => {
    const v = new DataView(bytes.buffer);
    const s = (o: number) => String.fromCharCode(...bytes.slice(o, o + 4));
    expect(s(0)).toBe('RIFF');
    expect(s(8)).toBe('WAVE');
    expect(s(12)).toBe('fmt ');
    expect(s(36)).toBe('data');
    expect(v.getUint32(4, true)).toBe(36 + n * 4);
    expect(v.getUint16(20, true)).toBe(1);
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(24, true)).toBe(sr);
    expect(v.getUint32(28, true)).toBe(sr * 4);
    expect(v.getUint16(32, true)).toBe(4);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(n * 4);
  });
  it('has the right length and round-trips sample values', () => {
    expect(bytes.length).toBe(44 + n * 4);
    const d = decodeWavBytes(bytes);
    expect(d.sampleRate).toBe(sr);
    for (let i = 0; i < n; i++) {
      expect(Math.abs(d.channels[0][i] - left[i])).toBeLessThan(1 / 16000);
      expect(Math.abs(d.channels[1][i] - right[i])).toBeLessThan(1 / 16000);
    }
  });
  it('normalises only when the peak exceeds -1 dBFS', () => {
    const loud = Float32Array.from({ length: 10 }, (_, i) => (i === 3 ? 1.5 : 0.1));
    const d = decodeWavBytes(encodeWavBytes([loud], sr));
    expect(Math.max(...d.channels[0].map(Math.abs))).toBeLessThanOrEqual(NORMALISE_CEILING + 1e-4);
    expect(Math.max(...d.channels[0])).toBeGreaterThan(NORMALISE_CEILING - 1e-3);
  });
});

describe('describe this moment', () => {
  const ocean = sceneById('ocean');
  const base = (u: number | null, value: number | null, x = 0.36, y = 0.19): FrameFeatures => ({
    t: 10,
    global: { u: 0.5, coverage: 0.7, motion: 0, spread: 0 },
    probes: [{ x, y, r: 0.03, u, value, coverage: 0.9, spread: 0.02, motion: 0, confidence: 0.85 }],
    events: [],
  });
  it('describes a continuous reading with coordinates', () => {
    const text = describeMoment(base(0.125, 4), ocean, { trends: ['falling'] });
    expect(text).toBe(
      'Probe 1 at 56° north, 50° west. Estimated sea surface temperature 4 °C, in the lowest fifth of the scale. Falling. Confidence high. Estimated from pixel colour.',
    );
  });
  it('describes the no-reading case', () => {
    expect(describeMoment(base(null, null), ocean)).toBe('Probe 1 is over an area with no data colour, probably land. No reliable reading here.');
  });
  it('describes events', () => {
    const lightning = sceneById('lightning');
    const events = [0.45, 0.5, 0.55, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9].map((x) => ({ x, y: 0.5, strength: 1 }));
    expect(describeMoment({ ...base(null, null), events }, lightning)).toBe(
      'About 9 lightning events on screen, mostly in the centre and right, mostly in the tropics. Estimated from pixel colour.',
    );
  });
  it('describes the scan line for categorical scenes', () => {
    const aerosols = sceneById('aerosols');
    const f: FrameFeatures = { ...base(null, null), scanX: 0.4, probes: [], global: { u: null, coverage: 0.6, motion: 0, spread: 0, classFractions: { seaSalt: 0.4, dust: 0.15, sulfate: 0.02, blackCarbon: 0 } } };
    expect(describeMoment(f, aerosols, { classLabels: { seaSalt: 'Sea salt', dust: 'Dust', sulfate: 'Sulfate', blackCarbon: 'Black carbon / smoke' } })).toBe(
      'At the scan line: mostly sea salt, some dust. Position 40% of the way from west to east. Estimated from pixel colour.',
    );
  });
  it('computes trends', () => {
    expect(trendOf(0.5, 0.4)).toBe('rising');
    expect(trendOf(0.4, 0.5)).toBe('falling');
    expect(trendOf(0.5, 0.505)).toBe('steady');
    expect(trendOf(null, 0.5)).toBeNull();
  });
  it('splits speech into sentences', () => {
    expect(splitSentences('Probe 1 at 4 °C. Confidence high. Estimated.')).toEqual(['Probe 1 at 4 °C.', 'Confidence high.', 'Estimated.']);
  });
});

describe('audio legend script', () => {
  it('names the lowest, middle and highest values for ocean', () => {
    const s = legendSteps(sceneById('ocean'));
    expect(s.slice(0, 3)).toEqual(['Lowest: 0 °C', 'Middle: 16 °C', 'Highest: 32 °C']);
    expect(s[4]).toBe('Louder means more data under the probe. Left and right follow west and east.');
  });
});

describe('export sidecar', () => {
  it('contains every required field', () => {
    const scene = sceneById('ocean');
    const s = buildSidecar(scene, defaultModeConfig('musical'), [{ x: 0.3, y: 0.3, r: 0.03 }], 66);
    for (const k of SIDECAR_FIELDS) expect(s).toHaveProperty(k);
    expect(s.statement).toBe(HONESTY_STATEMENT);
    expect(s.scene.svsUrl).toBe('https://svs.gsfc.nasa.gov/3912/');
    expect(s.mode).toBe('musical');
    expect(s.lut).toBe('luts/ocean.json');
    expect(s.constants.F_MIN).toBeCloseTo(130.81);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('manifest and lookup-table validators', () => {
  it('accept the real manifest and lookup tables', () => {
    expect(validateManifest(realManifest())).toBeNull();
    expect(validateLut(realLut('ocean'))).toBeNull();
    expect(validateLut(realLut('aerosols'))).toBeNull();
  });
  it('reject broken manifests with clear messages', () => {
    const m = realManifest();
    const noScenes = { ...m, scenes: [] };
    expect(validateManifest(noScenes)).toBe('The manifest lists no scenes.');
    const badRange = structuredClone(m);
    badRange.scenes[0].quantity.vmax = badRange.scenes[0].quantity.vmin;
    expect(validateManifest(badRange)).toBe('Scene "ocean" quantity range is invalid (vmax must exceed vmin).');
    const noLut = structuredClone(m);
    (noLut.scenes[0] as { lut: string | null }).lut = null;
    expect(validateManifest(noLut)).toBe('Scene "ocean" needs a lookup table for "hue" matching.');
    expect(validateManifest('nope')).toBe('The manifest is not a JSON object.');
  });
  it('reject a lookup table with the wrong number of colours', () => {
    const l = structuredClone(realLut('ocean')) as { rgb: unknown[] };
    l.rgb.pop();
    expect(validateLut(l)).toBe('The lookup table should have 256 colours.');
  });
});
