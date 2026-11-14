import type { Scene } from '../scenes/types';
import type { FrameFeatures, ProbeFeatures, SceneEvent } from '../engine/types';
import { confidenceWord, formatValue, pct } from '../lib/format';
import { spokenLatLon, toLonLat } from '../lib/geo';

export const PROVENANCE_LABEL = 'Estimated from pixel colour';

export type Trend = 'rising' | 'falling' | 'steady' | null;

export type DescribeOptions = {
  /** Trend of probe 1, from the change in smoothed u over the last 2 seconds. */
  trends?: Trend[];
  /** Events seen over the last second, for event scenes. */
  recentEvents?: SceneEvent[];
  classLabels?: Record<string, string>;
};

const FIFTHS = ['lowest fifth', 'second fifth', 'middle fifth', 'fourth fifth', 'highest fifth'];

export const fifthOf = (u: number) => FIFTHS[Math.min(4, Math.floor(Math.max(0, u) * 5))];

/** Trend from smoothed u now and about 2 seconds ago. */
export function trendOf(uNow: number | null, uThen: number | null): Trend {
  if (uNow === null || uThen === null) return null;
  const d = uNow - uThen;
  return d > 0.02 ? 'rising' : d < -0.02 ? 'falling' : 'steady';
}

function where(p: { x: number; y: number }, scene: Scene): string {
  if (scene.geo) {
    const { lat, lon } = toLonLat(p.x, p.y, scene.geo);
    return `at ${spokenLatLon(lat, lon)}`;
  }
  return `at ${pct(p.x)} across and ${pct(p.y)} down the picture`;
}

function classSummary(fr: Record<string, number> | undefined, labels: Record<string, string>): string | null {
  const entries = Object.entries(fr ?? {})
    .filter(([, v]) => v > 0.02)
    .sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  const name = (id: string) => (labels[id] ?? id).toLowerCase();
  const [top, ...rest] = entries;
  const some = rest.filter(([, v]) => v >= top[1] * 0.25).map(([k]) => name(k));
  return `mostly ${name(top[0])}${some.length ? `, some ${some.join(' and some ')}` : ''}`;
}

export function describeProbe(p: ProbeFeatures, index: number, scene: Scene, opts: DescribeOptions = {}): string {
  const q = scene.quantity;
  const label = `Probe ${index + 1}`;
  if (q.kind === 'categorical') {
    const s = classSummary(p.classFractions, opts.classLabels ?? {});
    return s
      ? `${label} ${where(p, scene)}: ${s}. ${PROVENANCE_LABEL}.`
      : `${label} ${where(p, scene)} is over an area with no aerosol colour recognised. ${PROVENANCE_LABEL}.`;
  }
  if (q.kind === 'event') {
    return `${label} ${where(p, scene)}: about ${Math.round(p.value ?? 0)}% of the probe shows lightning dots. ${PROVENANCE_LABEL}.`;
  }
  if (p.value === null || p.u === null) {
    return `${label} is over an area with no data colour, probably land. No reliable reading here.`;
  }
  const trend = opts.trends?.[index];
  const parts = [
    `${label} ${where(p, scene)}.`,
    `Estimated ${q.name} ${formatValue(p.value, q.unit, q.vmax - q.vmin)}, in the ${fifthOf(p.u)} of the scale.`,
    trend ? `${trend[0].toUpperCase()}${trend.slice(1)}.` : '',
    `Confidence ${confidenceWord(p.confidence)}.`,
    `${PROVENANCE_LABEL}.`,
  ];
  return parts.filter(Boolean).join(' ');
}

function describeEvents(events: SceneEvent[], scene: Scene): string {
  if (!events.length) return `No new lightning events on screen at this moment. ${PROVENANCE_LABEL}.`;
  const thirds = [0, 0, 0];
  const bands = [0, 0, 0]; // south, tropics, north
  for (const e of events) {
    thirds[Math.min(2, Math.floor(e.x * 3))]++;
    if (scene.geo) {
      const lat = scene.geo.north - e.y * (scene.geo.north - scene.geo.south);
      bands[lat < -23.44 ? 0 : lat <= 23.44 ? 1 : 2]++;
    } else {
      bands[Math.min(2, Math.floor((1 - e.y) * 3))]++;
    }
  }
  const n = events.length;
  const hNames = ['left', 'centre', 'right'];
  const hs = hNames.filter((_, i) => thirds[i] / n >= 0.3);
  const bNames = scene.geo ? ['in the south', 'in the tropics', 'in the north'] : ['low on the screen', 'in the middle', 'high on the screen'];
  const bTop = bands.indexOf(Math.max(...bands));
  const hText = hs.length === 3 || hs.length === 0 ? 'spread across the screen' : `mostly in the ${hs.join(' and ')}`;
  return `About ${n} lightning event${n === 1 ? '' : 's'} on screen, ${hText}, ${bands[bTop] / n > 0.5 ? 'mostly ' : ''}${bNames[bTop]}. ${PROVENANCE_LABEL}.`;
}

/** Section 11.4: template text for "Describe this moment". */
export function describe(f: FrameFeatures, scene: Scene, opts: DescribeOptions = {}): string {
  const q = scene.quantity;
  const out: string[] = [];
  if (q.kind === 'event') {
    out.push(describeEvents(opts.recentEvents ?? f.events, scene));
    return out.join(' ');
  }
  if (q.kind === 'categorical' && f.scanX !== undefined) {
    const s = classSummary(f.global.classFractions, opts.classLabels ?? {});
    out.push(
      `At the scan line: ${s ?? 'no aerosol colour recognised'}. Position ${pct(f.scanX)} of the way from west to east. ${PROVENANCE_LABEL}.`,
    );
  }
  f.probes.forEach((p, i) => out.push(describeProbe(p, i, scene, opts)));
  return out.join(' ');
}

/** Short label for a probe button. */
export function probeAriaLabel(p: ProbeFeatures | undefined, spec: { x: number; y: number }, index: number, scene: Scene): string {
  const place = scene.geo
    ? (() => {
        const { lat, lon } = toLonLat(spec.x, spec.y, scene.geo!);
        return spokenLatLon(lat, lon);
      })()
    : `${pct(spec.x)} across, ${pct(spec.y)} down`;
  const q = scene.quantity;
  let reading = '';
  if (p && q.kind === 'continuous') reading = p.value === null ? 'no reliable reading' : formatValue(p.value, q.unit, q.vmax - q.vmin);
  return `Probe ${index + 1}, ${place}${reading ? `, ${reading}` : ''}`;
}
