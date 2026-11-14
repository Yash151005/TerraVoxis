import { formatTime, spokenTime } from '../lib/format';
import { useSettingsStore } from '../state/useSettingsStore';
import { useStudioStore } from '../state/useStudioStore';

type Props = {
  onLegend: () => void;
  onPlayPause: () => void;
  onSeek: (t: number) => void;
  onRate: (r: number) => void;
  onMute: () => void;
  disabled: boolean;
  isScan: boolean;
};

export function Transport({ onLegend, onPlayPause, onSeek, onRate, onMute, disabled, isScan }: Props) {
  const playing = useStudioStore((s) => s.playing);
  const time = useStudioStore((s) => s.time);
  const duration = useStudioStore((s) => s.duration);
  const rate = useStudioStore((s) => s.rate);
  const muted = useStudioStore((s) => s.muted);
  const legendPlaying = useStudioStore((s) => s.legendPlaying);
  const volume = useSettingsStore((s) => s.volume);
  const setSettings = useSettingsStore((s) => s.set);
  const btn = 'min-h-11 rounded border border-edge px-3 font-medium hover:bg-raised disabled:opacity-50';

  return (
    <section
      aria-label="Transport"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 px-3 py-2 backdrop-blur lg:static lg:mt-4 lg:rounded-md lg:border"
    >
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onLegend} className="min-h-11 rounded bg-sound px-4 font-semibold text-bg hover:brightness-110" aria-pressed={legendPlaying} aria-keyshortcuts="L">
          {legendPlaying ? 'Stop the legend' : 'Play the legend'}
        </button>
        <button type="button" onClick={onPlayPause} className={btn} disabled={disabled} aria-keyshortcuts="Space K">
          {playing ? 'Pause' : isScan ? 'Play scan' : 'Play'}
        </button>
        <label className="flex min-w-48 flex-1 items-center gap-2">
          <span className="sr-only">{isScan ? 'Scan position' : 'Seek'}</span>
          <input
            type="range"
            className="w-full"
            min={0}
            max={Math.max(0.1, duration)}
            step={0.1}
            value={Math.min(time, duration)}
            disabled={disabled}
            aria-valuetext={`${spokenTime(time)} of ${spokenTime(duration)}`}
            onChange={(e) => onSeek(Number(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                onSeek(Math.min(duration, Math.max(0, time + (e.key === 'ArrowRight' ? 5 : -5))));
              }
            }}
          />
        </label>
        <span className="font-mono text-sm tabular-nums" aria-hidden="true">
          {formatTime(time)} / {formatTime(duration)}
        </span>
        <label className="flex items-center gap-1 text-sm">
          <span>Speed</span>
          <select className="min-h-11 rounded border border-edge bg-bg px-1" value={rate} onChange={(e) => onRate(Number(e.target.value))}>
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm">
          <span>Volume</span>
          <input
            type="range"
            className="w-24"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            aria-valuetext={`${Math.round(volume * 100)} percent`}
            onChange={(e) => setSettings({ volume: Number(e.target.value) / 100 })}
          />
        </label>
        <button type="button" onClick={onMute} className={btn} aria-pressed={muted} aria-keyshortcuts="M">
          {muted ? 'Unmute' : 'Mute'}
        </button>
      </div>
    </section>
  );
}
