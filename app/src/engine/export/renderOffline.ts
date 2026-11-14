import type { Scene } from '../../scenes/types';
import type { FrameFeatures } from '../types';
import { FeatureSmoother, valuesFromU } from '../analysis/smoothing';
import { applyTargets, buildGraph } from '../audio/buildGraph';
import { initialMappingState, mapFeatures } from '../mapping/mapFeatures';
import { MODES, type ModeConfig } from '../mapping/modes';

export const EXPORT_SAMPLE_RATE = 44100;

/**
 * Export step 2: an OfflineAudioContext built by the same buildGraph, driven by the same
 * mapFeatures as live playback.
 */
export async function renderOffline(
  timeline: FrameFeatures[],
  scene: Scene,
  mode: ModeConfig,
  classIds: string[],
  OfflineCtor: typeof OfflineAudioContext = OfflineAudioContext,
): Promise<AudioBuffer> {
  if (!timeline.length) throw new Error('Nothing to render: the feature timeline is empty.');
  const t0 = timeline[0].t;
  const length = timeline[timeline.length - 1].t - t0 + 1;
  const ctx = new OfflineCtor(2, Math.ceil(length * EXPORT_SAMPLE_RATE), EXPORT_SAMPLE_RATE);
  const graph = buildGraph(ctx, classIds);
  const smoother = new FeatureSmoother(MODES[mode.mode].tau);
  let state = initialMappingState();
  const q = scene.quantity;
  for (const raw of timeline) {
    const f = valuesFromU(smoother.step(raw), q.vmin, q.vmax, q.kind === 'continuous');
    const r = mapFeatures(f, scene, mode, state);
    state = r.state;
    applyTargets(graph, r.targets, raw.t - t0 + 0.02);
  }
  // Fade out at the end.
  const end = timeline[timeline.length - 1].t - t0 + 0.2;
  graph.master.gain.setTargetAtTime(0, end, 0.05);
  return ctx.startRendering();
}
