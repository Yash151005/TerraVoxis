import type { Lut, Manifest } from './types';

/** Small hand-written validator. Returns the first problem in words, or null when valid. */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const in01 = (v: unknown) => isNum(v) && v >= 0 && v <= 1;

export function validateManifest(m: unknown): string | null {
  if (!isObj(m)) return 'The manifest is not a JSON object.';
  if (m.version !== 1) return `Unsupported manifest version: ${String(m.version)}.`;
  if (!Array.isArray(m.scenes) || m.scenes.length === 0) return 'The manifest lists no scenes.';
  const seen = new Set<string>();
  for (let i = 0; i < m.scenes.length; i++) {
    const s = m.scenes[i] as unknown;
    const where = `Scene ${i + 1}`;
    if (!isObj(s)) return `${where} is not an object.`;
    if (!isStr(s.id)) return `${where} has no id.`;
    const at = `Scene "${s.id}"`;
    if (seen.has(s.id)) return `${at} appears twice.`;
    seen.add(s.id);
    if (!isStr(s.title)) return `${at} has no title.`;
    if (!isNum(s.svsId)) return `${at} has no SVS id.`;
    if (!isStr(s.svsUrl) || !s.svsUrl.startsWith('https://svs.gsfc.nasa.gov/')) return `${at} has no valid SVS link.`;
    const media = s.media;
    if (!isObj(media)) return `${at} has no media.`;
    if (media.kind !== 'video' && media.kind !== 'image') return `${at} media kind must be "video" or "image".`;
    if (!isStr(media.src)) return `${at} media has no source file.`;
    if (!isNum(media.width) || !isNum(media.height) || media.width <= 0 || media.height <= 0)
      return `${at} media has no valid size.`;
    const q = s.quantity;
    if (!isObj(q)) return `${at} has no quantity.`;
    if (!['continuous', 'categorical', 'event'].includes(q.kind as string)) return `${at} quantity kind is not recognised.`;
    if (!isNum(q.vmin) || !isNum(q.vmax) || q.vmax <= q.vmin) return `${at} quantity range is invalid (vmax must exceed vmin).`;
    const match = s.match;
    if (!isObj(match) || !['lab', 'hue', 'categorical', 'event'].includes(match.method as string))
      return `${at} match method is not recognised.`;
    if (!isNum(match.maxDistance) || !isNum(match.minChroma)) return `${at} match thresholds are missing.`;
    if (match.method !== 'event' && !isStr(s.lut)) return `${at} needs a lookup table for "${String(match.method)}" matching.`;
    if (match.method === 'event' && !isObj(s.events)) return `${at} uses event matching but has no event settings.`;
    if (s.geo !== null) {
      const g = s.geo;
      if (!isObj(g) || !isNum(g.west) || !isNum(g.east) || !isNum(g.north) || !isNum(g.south))
        return `${at} geo bounds are incomplete.`;
    }
    if (!Array.isArray(s.masks)) return `${at} masks must be a list.`;
    for (const r of s.masks) {
      if (!isObj(r) || !in01(r.x) || !in01(r.y) || !in01(r.w) || !in01(r.h)) return `${at} has a mask outside 0–1.`;
    }
    const a = s.analysis;
    if (!isObj(a) || !isNum(a.width) || !isNum(a.height) || a.width < 8 || a.height < 8) return `${at} analysis size is invalid.`;
    if (!Array.isArray(s.defaultProbes) || s.defaultProbes.length === 0) return `${at} has no default probe.`;
    for (const p of s.defaultProbes) {
      if (!isObj(p) || !in01(p.x) || !in01(p.y) || !isNum(p.r) || p.r <= 0) return `${at} has an invalid default probe.`;
    }
    const mus = s.musical;
    if (!isObj(mus) || !['majorPentatonic', 'minorPentatonic', 'dorian'].includes(mus.scale as string))
      return `${at} musical scale is not recognised.`;
    if (!isStr(s.description)) return `${at} has no text description.`;
    if (!isStr(s.provenance)) return `${at} has no provenance statement.`;
    if (!Array.isArray(s.credits)) return `${at} has no credits.`;
  }
  return null;
}

export function validateLut(l: unknown): string | null {
  if (!isObj(l)) return 'The lookup table is not a JSON object.';
  if (l.kind === 'continuous') {
    if (!isNum(l.n) || l.n < 2) return 'The lookup table has fewer than two entries.';
    if (!Array.isArray(l.rgb) || l.rgb.length !== l.n) return `The lookup table should have ${String(l.n)} colours.`;
    for (const c of l.rgb) {
      if (!Array.isArray(c) || c.length !== 3 || !c.every((v) => isNum(v) && v >= 0 && v <= 255))
        return 'The lookup table contains a colour that is not three numbers from 0 to 255.';
    }
    return null;
  }
  if (l.kind === 'categorical') {
    if (!Array.isArray(l.classes) || l.classes.length === 0) return 'The lookup table has no classes.';
    for (const c of l.classes) {
      if (!isObj(c) || !isStr(c.id) || !isStr(c.label)) return 'A class in the lookup table has no id or label.';
      if (!Array.isArray(c.rgb) || c.rgb.length < 1 || c.rgb.length > 4) return `Class "${c.id}" needs 1 to 4 colour samples.`;
    }
    return null;
  }
  return `Unknown lookup table kind: ${String(l.kind)}.`;
}

export function asManifest(m: unknown): Manifest {
  const err = validateManifest(m);
  if (err) throw new Error(err);
  return m as Manifest;
}

export function asLut(l: unknown): Lut {
  const err = validateLut(l);
  if (err) throw new Error(err);
  return l as Lut;
}
