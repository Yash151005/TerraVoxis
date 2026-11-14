import type { EventConfig } from '../../scenes/types';
import type { SceneEvent } from '../types';

/**
 * Section 7.7. `lit` and `prevLit` are per-pixel flags (1 = lit) for an image of width w and height h.
 * A pixel is new when lit now and not lit in the previous analysed frame. New pixels are binned into
 * the event grid; each occupied cell yields one event at its centre of mass. `mask` (1 = ignore) is optional.
 */
export function detectEvents(
  lit: Uint8Array,
  prevLit: Uint8Array | null,
  w: number,
  h: number,
  cfg: EventConfig,
  mask?: Uint8Array | null,
): SceneEvent[] {
  if (!prevLit) return [];
  const [gw, gh] = cfg.grid;
  const count = new Uint32Array(gw * gh);
  const sx = new Float64Array(gw * gh);
  const sy = new Float64Array(gw * gh);
  for (let y = 0; y < h; y++) {
    const gy = Math.min(gh - 1, Math.floor((y * gh) / h));
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!lit[i] || prevLit[i] || (mask && mask[i])) continue;
      const gx = Math.min(gw - 1, Math.floor((x * gw) / w));
      const c = gy * gw + gx;
      count[c]++;
      sx[c] += (x + 0.5) / w;
      sy[c] += (y + 0.5) / h;
    }
  }
  const events: SceneEvent[] = [];
  for (let c = 0; c < count.length; c++) {
    const n = count[c];
    if (n === 0) continue;
    events.push({ x: sx[c] / n, y: sy[c] / n, strength: Math.min(1, n / 6) });
  }
  events.sort((a, b) => b.strength - a.strength);
  return events.slice(0, cfg.maxPerFrame);
}
