import { MODES, type ModeName } from '../engine/mapping/modes';
import { useStudioStore } from '../state/useStudioStore';

const NOTES: Record<ModeName, string> = {
  scientific: 'Pitch follows the value continuously. No reverb.',
  musical: 'Pitches are rounded to a musical scale, so small differences may be hidden.',
  accessibility: 'Eight clear pitch steps, slower smoothing, a reference tone, and probes take turns.',
};

export function ModePicker() {
  const mode = useStudioStore((s) => s.mode);
  const setMode = useStudioStore((s) => s.setMode);
  return (
    <fieldset className="rounded-md border border-border p-3">
      <legend className="px-1 font-semibold">Mode</legend>
      {(Object.keys(MODES) as ModeName[]).map((m, i) => (
        <label key={m} className="flex min-h-10 items-start gap-3 py-1">
          <input type="radio" name="mode" value={m} className="mt-1 h-5 w-5 accent-sound" checked={mode === m} onChange={() => setMode(m)} aria-describedby={`mode-note-${m}`} />
          <span>
            {MODES[m].label} <span className="font-mono text-xs text-muted" aria-hidden="true">({i + 1})</span>
            <span id={`mode-note-${m}`} className="block text-sm text-muted">
              {NOTES[m]}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
