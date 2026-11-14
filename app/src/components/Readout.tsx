import { PROVENANCE_LABEL } from '../a11y/describe';
import type { FrameFeatures, ProbeFeatures } from '../engine/types';
import { confidenceWord, formatValue, pct } from '../lib/format';
import { placeOf } from '../lib/geo';
import type { Scene } from '../scenes/types';

function ProbeCard({ p, i, scene, classLabels }: { p: ProbeFeatures; i: number; scene: Scene; classLabels: Record<string, string> }) {
  const q = scene.quantity;
  const place = placeOf(p.x, p.y, scene.geo) ?? `${pct(p.x)} across, ${pct(p.y)} down`;
  let main: React.ReactNode;
  if (q.kind === 'continuous') {
    main =
      p.value === null ? (
        <span className="text-lg">No reliable reading here</span>
      ) : (
        <span className="font-mono text-3xl text-data">{formatValue(p.value, q.unit, q.vmax - q.vmin)}</span>
      );
  } else if (q.kind === 'event') {
    main = <span className="font-mono text-2xl text-data">{Math.round(p.value ?? 0)}% lit</span>;
  } else {
    const entries = Object.entries(p.classFractions ?? {})
      .filter(([, v]) => v >= 0.01)
      .sort((a, b) => b[1] - a[1]);
    main = entries.length ? (
      <ul className="font-mono text-sm">
        {entries.map(([k, v]) => (
          <li key={k}>
            {classLabels[k] ?? k}: <span className="text-data">{pct(v)}</span>
          </li>
        ))}
      </ul>
    ) : (
      <span className="text-lg">No aerosol colour recognised here</span>
    );
  }
  const showConf = q.kind !== 'event' && !(q.kind === 'continuous' && p.value === null);
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <h3 className="flex items-baseline justify-between gap-2 text-sm font-semibold text-muted">
        <span>Probe {i + 1}</span>
        <span className="font-mono font-normal">{place}</span>
      </h3>
      <div className="mt-1">{main}</div>
      {showConf && (
        <p className="mt-1 text-sm">
          Confidence {confidenceWord(p.confidence)} ({pct(p.confidence)})
        </p>
      )}
      <p className="mt-1 text-xs text-sound">{PROVENANCE_LABEL}</p>
    </div>
  );
}

export function Readout({ readout, scene, classLabels, recentEventCount }: { readout: FrameFeatures | null; scene: Scene; classLabels: Record<string, string>; recentEventCount: number }) {
  return (
    <section aria-labelledby="readout-h">
      <h2 id="readout-h" className="mb-2 text-lg font-semibold">
        Readout
      </h2>
      {!readout && <p className="text-muted">Waiting for the first frame…</p>}
      {readout && scene.quantity.kind === 'event' && (
        <p className="mb-2">
          <span className="font-mono text-2xl text-data">{recentEventCount}</span> new lightning events in the last second
        </p>
      )}
      <div className="grid gap-2">
        {readout?.probes.map((p, i) => (
          <ProbeCard key={i} p={p} i={i} scene={scene} classLabels={classLabels} />
        ))}
      </div>
    </section>
  );
}
