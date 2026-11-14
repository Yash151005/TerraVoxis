import { speechSupported } from '../a11y/speech';
import { hapticsSupported } from '../engine/haptics/haptics';
import { MODES, type ModeName } from '../engine/mapping/modes';
import { useSettingsStore } from '../state/useSettingsStore';
import { Dialog } from './Dialog';

function Check({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex min-h-10 items-start gap-3 py-2">
      <input type="checkbox" className="mt-1 h-5 w-5 accent-sound" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useSettingsStore();
  return (
    <Dialog open={open} onClose={onClose} title="Settings">
      <p className="mb-3 text-sm text-muted">Settings are saved in this browser only.</p>
      <Check
        label="Speak descriptions aloud (turn off if you use a screen reader)"
        hint={speechSupported() ? 'Uses your browser’s built-in voice.' : 'This browser has no speech synthesis.'}
        checked={s.speech}
        disabled={!speechSupported()}
        onChange={(v) => s.set({ speech: v })}
      />
      <Check label="Single-key shortcuts" hint="Space, K, L, D, M, 1, 2, 3 and ?. Never active while typing." checked={s.shortcuts} onChange={(v) => s.set({ shortcuts: v })} />
      <Check label="High contrast" hint="Black and white with a yellow focus ring." checked={s.highContrast} onChange={(v) => s.set({ highContrast: v })} />
      <Check
        label="Vibration cues"
        hint={
          hapticsSupported()
            ? 'While playing: 1 to 4 short pulses when probe 1 moves into a new value quarter (1 = lowest, 4 = highest), and a tap for new lightning.'
            : 'This browser or device cannot vibrate (Android Chrome can; iPhone Safari cannot).'
        }
        checked={s.haptics}
        disabled={!hapticsSupported()}
        onChange={(v) => s.set({ haptics: v })}
      />
      <fieldset className="mt-3">
        <legend className="font-semibold">Reduced motion</legend>
        {(
          [
            ['system', 'Follow my system setting'],
            ['on', 'Always reduce motion'],
            ['off', 'Never reduce motion'],
          ] as const
        ).map(([v, label]) => (
          <label key={v} className="flex min-h-10 items-center gap-3">
            <input type="radio" name="reduced-motion" className="h-5 w-5 accent-sound" checked={s.reducedMotion === v} onChange={() => s.set({ reducedMotion: v })} />
            {label}
          </label>
        ))}
      </fieldset>
      <label className="mt-3 flex flex-col gap-1">
        <span className="font-semibold">Default mode</span>
        <select
          className="min-h-10 rounded border border-edge bg-bg px-2"
          value={s.defaultMode}
          onChange={(e) => s.set({ defaultMode: e.target.value as ModeName })}
        >
          {(Object.keys(MODES) as ModeName[]).map((m) => (
            <option key={m} value={m}>
              {MODES[m].label}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="mt-3">
        <legend className="font-semibold">Default polarity</legend>
        <label className="flex min-h-10 items-center gap-3">
          <input type="radio" name="polarity-default" className="h-5 w-5 accent-sound" checked={s.polarity === 1} onChange={() => s.set({ polarity: 1 })} />
          Higher pitch means more
        </label>
        <label className="flex min-h-10 items-center gap-3">
          <input type="radio" name="polarity-default" className="h-5 w-5 accent-sound" checked={s.polarity === -1} onChange={() => s.set({ polarity: -1 })} />
          Higher pitch means less
        </label>
      </fieldset>
      <label className="mt-3 flex flex-col gap-1">
        <span className="font-semibold">Master volume</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(s.volume * 100)}
          aria-valuetext={`${Math.round(s.volume * 100)} percent`}
          onChange={(e) => s.set({ volume: Number(e.target.value) / 100 })}
        />
      </label>
    </Dialog>
  );
}
