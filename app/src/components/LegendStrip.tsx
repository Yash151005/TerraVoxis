import type { FrameFeatures } from '../engine/types';
import { formatValue, pct } from '../lib/format';
import type { Lut, Scene } from '../scenes/types';

const rgb = (c: number[]) => `rgb(${c[0]} ${c[1]} ${c[2]})`;

export function LegendStrip({ scene, lut, readout }: { scene: Scene; lut: Lut | null | undefined; readout: FrameFeatures | null }) {
  const q = scene.quantity;
  if (q.kind === 'event') {
    return (
      <div className="mt-3 flex items-center gap-3 text-sm">
        <span className="inline-block h-3 w-3 rounded-full bg-[#e6c619]" aria-hidden="true" />
        <span>Yellow-orange dots: lightning detected by the ISS Lightning Imaging Sensor over a roving 10-day window. Grey: the Earth.</span>
      </div>
    );
  }
  if (!lut) return <p className="mt-3 text-sm text-muted">The colour legend is not available, so no values can be estimated for this scene.</p>;
  if (lut.kind === 'categorical') {
    const fr = readout?.global.classFractions ?? {};
    return (
      <div className="mt-3">
        <h3 className="sr-only">Colour legend</h3>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {lut.classes.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-sm">
              <span className="inline-block h-4 w-6 shrink-0 rounded-sm border border-edge" style={{ background: rgb(c.swatch ?? c.rgb[0]) }} aria-hidden="true" />
              <span>
                {c.label}
                <span className="ml-1 font-mono text-muted">{pct(fr[c.id] ?? 0)}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-muted">Percentages: share of the scan band in each colour. Estimated from pixel colour.</p>
      </div>
    );
  }
  const stops = lut.rgb.filter((_, i) => i % 16 === 0 || i === lut.rgb.length - 1).map(rgb);
  const span = q.vmax - q.vmin;
  return (
    <div className="mt-6">
      <h3 className="sr-only">Colour legend</h3>
      <div className="relative h-4 rounded-sm border border-edge" style={{ background: `linear-gradient(90deg, ${stops.join(', ')})` }} aria-hidden="true">
        {readout?.probes.map((p, i) =>
          p.u === null ? null : (
            <span key={i} className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_0_1px_#000]" style={{ left: `${p.u * 100}%` }}>
              <span className="absolute bottom-full mb-0.5 left-1/2 -translate-x-1/2 font-mono text-xs leading-none">{i + 1}</span>
            </span>
          ),
        )}
      </div>
      <div className="mt-1 flex justify-between font-mono text-sm">
        <span>{formatValue(q.vmin, q.unit, span)}</span>
        <span className="text-muted">{q.name}</span>
        <span>{formatValue(q.vmax, q.unit, span)}</span>
      </div>
    </div>
  );
}
