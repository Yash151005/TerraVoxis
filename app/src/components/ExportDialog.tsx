import { useEffect, useRef, useState } from 'react';
import { announce } from '../a11y/announce';
import type { AnalysisContext } from '../engine/analysis/features';
import { EXPORT_MAX_SECONDS, runFeaturePass } from '../engine/export/featurePass';
import { renderOffline } from '../engine/export/renderOffline';
import { buildSidecar, sidecarBlob } from '../engine/export/sidecar';
import { encodeWav, peakOf } from '../engine/export/wav';
import { MODES } from '../engine/mapping/modes';
import type { Scene } from '../scenes/types';
import { modeConfigFromStore } from '../state/useSonification';
import { useStudioStore } from '../state/useStudioStore';
import { Dialog } from './Dialog';

type Phase = { kind: 'idle' } | { kind: 'analysing'; progress: number } | { kind: 'rendering' } | { kind: 'done'; wav: string; json: string; seconds: number } | { kind: 'error'; message: string };

type Props = {
  open: boolean;
  onClose: () => void;
  scene: Scene;
  ctx: AnalysisContext | null;
  getMedia: () => HTMLVideoElement | HTMLImageElement | null;
  onBeforeExport: () => void;
  onAfterExport: () => void;
};

export function ExportDialog({ open, onClose, scene, ctx, getMedia, onBeforeExport, onAfterExport }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const abort = useRef<AbortController | null>(null);
  const mode = useStudioStore((s) => s.mode);

  useEffect(() => {
    if (!open) {
      abort.current?.abort();
    }
  }, [open]);
  useEffect(
    () => () => {
      if (phase.kind === 'done') {
        URL.revokeObjectURL(phase.wav);
        URL.revokeObjectURL(phase.json);
      }
    },
    [phase],
  );

  const start = async () => {
    const media = getMedia();
    if (!media || !ctx) return;
    const ac = new AbortController();
    abort.current = ac;
    const s = useStudioStore.getState();
    const probes = s.probes.map((p) => ({ ...p }));
    const modeCfg = modeConfigFromStore();
    const resumeAt = media instanceof HTMLVideoElement ? media.currentTime : 0;
    onBeforeExport();
    try {
      setPhase({ kind: 'analysing', progress: 0 });
      announce('Export started: reading frames.', { requested: true });
      const timeline = await runFeaturePass(media, scene, ctx, probes, (p) => setPhase({ kind: 'analysing', progress: p }), ac.signal);
      setPhase({ kind: 'rendering' });
      const buffer = await renderOffline(timeline, scene, modeCfg, ctx.inverter.classIds);
      // Exposed for the end-to-end tests: raw peak before any normalisation.
      const w = window as unknown as { __terravoxis?: Record<string, unknown> };
      if (w.__terravoxis) w.__terravoxis.lastRenderPeak = peakOf(Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c)));
      const wav = URL.createObjectURL(encodeWav(buffer));
      const seconds = timeline.length ? timeline[timeline.length - 1].t - timeline[0].t : 0;
      const json = URL.createObjectURL(sidecarBlob(buildSidecar(scene, modeCfg, probes, seconds)));
      setPhase({ kind: 'done', wav, json, seconds });
      announce('Export finished. Two downloads are ready: the sound file and the mapping file.', { requested: true });
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setPhase({ kind: 'idle' });
        announce('Export cancelled.', { requested: true });
      } else {
        setPhase({ kind: 'error', message: (e as Error).message });
        announce(`Export failed: ${(e as Error).message}`, { requested: true });
      }
    } finally {
      if (media instanceof HTMLVideoElement) media.currentTime = resumeAt;
      onAfterExport();
    }
  };

  const busy = phase.kind === 'analysing' || phase.kind === 'rendering';
  const base = `${scene.id}-${mode}`;
  return (
    <Dialog
      open={open}
      onClose={() => {
        abort.current?.abort();
        onClose();
      }}
      title="Export sound"
    >
      <p>
        Renders the sonification of this scene in <strong>{MODES[mode].label}</strong> mode, with the current probes, to a WAV file, plus a
        mapping file that records exactly how the sound was made.
        {scene.media.kind === 'video'
          ? ` The video is stepped through at 10 frames per second (up to ${EXPORT_MAX_SECONDS} seconds), so this takes a little while.`
          : ' The scan is rendered from west to east.'}
      </p>
      <div className="mt-4" aria-live="off">
        {phase.kind === 'analysing' && (
          <div>
            <label className="block" htmlFor="export-progress">
              Reading frames: {Math.round(phase.progress * 100)}%
            </label>
            <progress id="export-progress" className="mt-1 w-full" max={1} value={phase.progress} />
          </div>
        )}
        {phase.kind === 'rendering' && <p>Rendering sound…</p>}
        {phase.kind === 'error' && (
          <p role="alert" className="text-danger">
            {phase.message}
          </p>
        )}
        {phase.kind === 'done' && (
          <div>
            <p>Ready: {Math.round(phase.seconds)} seconds of sound.</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              <li>
                <a className="inline-flex min-h-11 items-center rounded bg-sound px-4 font-semibold text-bg no-underline" href={phase.wav} download={`${base}.wav`}>
                  Download {base}.wav
                </a>
              </li>
              <li>
                <a className="inline-flex min-h-11 items-center rounded border border-edge px-4 no-underline" href={phase.json} download={`${base}.mapping.json`}>
                  Download {base}.mapping.json
                </a>
              </li>
            </ul>
          </div>
        )}
      </div>
      <div className="mt-5 flex gap-2">
        {!busy && (
          <button type="button" className="min-h-11 rounded bg-sound px-4 font-semibold text-bg disabled:opacity-50" onClick={start} disabled={!ctx}>
            {phase.kind === 'done' ? 'Export again' : 'Start export'}
          </button>
        )}
        {busy && (
          <button type="button" className="min-h-11 rounded border border-danger px-4" onClick={() => abort.current?.abort()}>
            Cancel
          </button>
        )}
      </div>
    </Dialog>
  );
}
