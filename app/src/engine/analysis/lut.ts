import type { EventConfig, Lut, Scene } from '../../scenes/types';
import { CELLS, cellColour, chroma, hue, srgbToLab, type Lab } from './color';

/** Common chroma used by hue matching: both colours are scaled to this chroma before comparing a and b. */
export const HUE_REFERENCE_CHROMA = 50;

export const INVALID = 0xffff;

export type Inverter = {
  method: Scene['match']['method'];
  /** Continuous: number of lookup entries. Categorical: number of classes. */
  n: number;
  classIds: string[];
  classLabels: string[];
  /** Per quantised cell: nearest entry or class, or INVALID. */
  index: Uint16Array;
  /** Per quantised cell: confidence 0..1 (0 when invalid). */
  confidence: Float32Array;
  /** Per quantised cell: distance to the nearest entry. */
  distance: Float32Array;
  /** Per quantised cell: CIELAB lightness. */
  lightness: Float32Array;
};

function labDistance(p: Lab, q: Lab) {
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

function hueVector(lab: Lab): [number, number] {
  const c = chroma(lab) || 1;
  return [(lab[1] / c) * HUE_REFERENCE_CHROMA, (lab[2] / c) * HUE_REFERENCE_CHROMA];
}

/** Lightness of every quantised cell; shared by all scenes. */
let lightnessTable: Float32Array | null = null;
export function getLightnessTable(): Float32Array {
  if (!lightnessTable) {
    lightnessTable = new Float32Array(CELLS);
    for (let cell = 0; cell < CELLS; cell++) {
      const [r, g, b] = cellColour(cell);
      lightnessTable[cell] = srgbToLab(r, g, b)[0];
    }
  }
  return lightnessTable;
}

/**
 * Build the 32x32x32 colour-to-value table. Each cell holds the nearest lookup entry
 * (continuous) or class (categorical) and the distance to it.
 */
export function createInverter(lut: Lut | null, match: Scene['match']): Inverter {
  const index = new Uint16Array(CELLS).fill(INVALID);
  const confidence = new Float32Array(CELLS);
  const distance = new Float32Array(CELLS).fill(Infinity);
  const lightness = getLightnessTable();
  const { method, maxDistance, minChroma } = match;

  if (method === 'event' || !lut) {
    return { method, n: 0, classIds: [], classLabels: [], index, confidence, distance, lightness };
  }

  if (lut.kind === 'continuous') {
    const entries = lut.rgb.map(([r, g, b]) => srgbToLab(r, g, b));
    const hueEntries = entries.map(hueVector);
    for (let cell = 0; cell < CELLS; cell++) {
      const [r, g, b] = cellColour(cell);
      const lab = srgbToLab(r, g, b);
      if (minChroma > 0 && chroma(lab) < minChroma) continue;
      let best = Infinity;
      let bestI = 0;
      if (method === 'hue') {
        const [pa, pb] = hueVector(lab);
        for (let i = 0; i < hueEntries.length; i++) {
          const d = Math.hypot(pa - hueEntries[i][0], pb - hueEntries[i][1]);
          if (d < best) {
            best = d;
            bestI = i;
          }
        }
      } else {
        for (let i = 0; i < entries.length; i++) {
          const d = labDistance(lab, entries[i]);
          if (d < best) {
            best = d;
            bestI = i;
          }
        }
      }
      distance[cell] = best;
      if (best <= maxDistance) {
        index[cell] = bestI;
        confidence[cell] = 1 - best / maxDistance;
      }
    }
    return { method, n: lut.n, classIds: [], classLabels: [], index, confidence, distance, lightness };
  }

  // Categorical: nearest sample of each class in CIELAB; the class with the smallest distance wins.
  const samples = lut.classes.map((c) => c.rgb.map(([r, g, b]) => srgbToLab(r, g, b)));
  for (let cell = 0; cell < CELLS; cell++) {
    const [r, g, b] = cellColour(cell);
    const lab = srgbToLab(r, g, b);
    if (minChroma > 0 && chroma(lab) < minChroma) continue;
    let best = Infinity;
    let bestK = 0;
    for (let k = 0; k < samples.length; k++) {
      for (const s of samples[k]) {
        const d = labDistance(lab, s);
        if (d < best) {
          best = d;
          bestK = k;
        }
      }
    }
    distance[cell] = best;
    if (best <= maxDistance) {
      index[cell] = bestK;
      confidence[cell] = 1 - best / maxDistance;
    }
  }
  return {
    method,
    n: lut.classes.length,
    classIds: lut.classes.map((c) => c.id),
    classLabels: lut.classes.map((c) => c.label),
    index,
    confidence,
    distance,
    lightness,
  };
}

/** Per-cell flag: does this colour count as a lit pixel for event detection? */
export function createLitTable(cfg: EventConfig): Uint8Array {
  const lit = new Uint8Array(CELLS);
  for (let cell = 0; cell < CELLS; cell++) {
    const [r, g, b] = cellColour(cell);
    const lab = srgbToLab(r, g, b);
    const h = hue(lab);
    if (lab[0] >= cfg.minLightness && chroma(lab) >= cfg.minChroma && h >= cfg.hueMin && h <= cfg.hueMax) lit[cell] = 1;
  }
  return lit;
}
