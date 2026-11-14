import type { StreamToggles as Toggles } from '../engine/mapping/modes';
import type { Scene } from '../scenes/types';
import { useStudioStore } from '../state/useStudioStore';

export function StreamToggles({ scene }: { scene: Scene }) {
  const streams = useStudioStore((s) => s.streams);
  const toggle = useStudioStore((s) => s.toggleStream);
  const probeOnly = useStudioStore((s) => s.probeOnly);
  const set = useStudioStore((s) => s.set);
  const kind = scene.quantity.kind;
  const items: { k: keyof Toggles; label: string }[] = [];
  if (scene.streams.includes('probe')) items.push({ k: 'probe', label: 'Probe voice' });
  if (scene.streams.includes('bed')) items.push({ k: 'bed', label: kind === 'event' ? 'Activity bed' : 'Global bed' });
  if (scene.streams.includes('motion')) items.push({ k: 'motion', label: 'Motion shimmer' });
  if (scene.streams.includes('events')) items.push({ k: 'events', label: 'Lightning events' });
  if (scene.streams.includes('classes')) items.push({ k: 'classes', label: 'Aerosol voices' });
  if (kind !== 'event') items.push({ k: 'reference', label: 'Reference tone (every 2 s, middle of the range)' });
  return (
    <fieldset className="rounded-md border border-border p-3">
      <legend className="px-1 font-semibold">Sound streams</legend>
      {items.map(({ k, label }) => (
        <label key={k} className="flex min-h-10 items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-sound" checked={streams[k]} onChange={(e) => toggle(k, e.target.checked)} />
          {label}
        </label>
      ))}
      {kind === 'categorical' && (
        <label className="flex min-h-10 items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-sound" checked={probeOnly} onChange={(e) => set({ probeOnly: e.target.checked })} />
          Probe only (voices follow probe 1, not the scan line)
        </label>
      )}
    </fieldset>
  );
}
