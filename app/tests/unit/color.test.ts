import { describe, expect, it } from 'vitest';
import { cellColour, cellIndex, chroma, hue, srgbToLab } from '../../src/engine/analysis/color';

// Reference values: CIELAB D65 from the standard sRGB matrices (Bruce Lindbloom's calculator).
const REF: [[number, number, number], [number, number, number]][] = [
  [[255, 255, 255], [100, 0, 0]],
  [[0, 0, 0], [0, 0, 0]],
  [[255, 0, 0], [53.24, 80.09, 67.2]],
  [[0, 255, 0], [87.73, -86.18, 83.18]],
  [[0, 0, 255], [32.3, 79.19, -107.86]],
  [[128, 128, 128], [53.59, 0, 0]],
  [[255, 255, 0], [97.14, -21.55, 94.48]],
];

describe('sRGB to CIELAB', () => {
  it.each(REF)('%j is within 0.5 of %j', (rgb, lab) => {
    const got = srgbToLab(...rgb);
    for (let k = 0; k < 3; k++) expect(Math.abs(got[k] - lab[k])).toBeLessThan(0.5);
  });

  it('computes chroma and hue', () => {
    const red = srgbToLab(255, 0, 0);
    expect(chroma(red)).toBeCloseTo(Math.hypot(80.09, 67.2), 0);
    expect(hue(red)).toBeCloseTo(40, 0);
    expect(hue(srgbToLab(0, 0, 255))).toBeGreaterThan(300);
  });

  it('quantises colours into 5-bit cells and back', () => {
    const c = cellIndex(200, 100, 50);
    const [r, g, b] = cellColour(c);
    expect(Math.abs(r - 200)).toBeLessThanOrEqual(4);
    expect(Math.abs(g - 100)).toBeLessThanOrEqual(4);
    expect(Math.abs(b - 50)).toBeLessThanOrEqual(4);
  });
});
