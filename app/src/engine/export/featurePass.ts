import type { ProbeSpec, Scene } from '../../scenes/types';
import type { FrameFeatures } from '../types';
import { Analyzer, type AnalysisContext } from '../analysis/features';
import { FrameSource } from '../analysis/frameSource';
import { SCAN_DEFAULT_SECONDS } from '../analysis/scan';

export const EXPORT_STEP = 0.1; // 10 steps per second
export const EXPORT_MAX_SECONDS = 120;

const abortError = () => new DOMException('Export cancelled', 'AbortError');

function seek(video: HTMLVideoElement, t: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const done = () => {
      video.removeEventListener('seeked', done);
      signal.removeEventListener('abort', abort);
      resolve();
    };
    const abort = () => {
      video.removeEventListener('seeked', done);
      reject(abortError());
    };
    video.addEventListener('seeked', done);
    signal.addEventListener('abort', abort, { once: true });
    video.currentTime = t;
  });
}

/**
 * Export step 1. Videos: step from 0 to the duration (cap 120 s) at 10 steps per second, seek,
 * analyse, store. Stills: generate the scan timeline directly.
 */
export async function runFeaturePass(
  media: HTMLVideoElement | HTMLImageElement,
  scene: Scene,
  ctx: AnalysisContext,
  probes: ProbeSpec[],
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<FrameFeatures[]> {
  const source = new FrameSource(ctx.width, ctx.height);
  const analyzer = new Analyzer(ctx);
  const out: FrameFeatures[] = [];
  if (media instanceof HTMLImageElement) {
    const duration = scene.scan?.duration ?? SCAN_DEFAULT_SECONDS;
    const img = source.capture(media);
    if (!img) throw new Error('The image has not loaded yet.');
    const steps = Math.round(duration / EXPORT_STEP);
    for (let i = 0; i <= steps; i++) {
      if (signal.aborted) throw abortError();
      const t = i * EXPORT_STEP;
      out.push(analyzer.analyse(img, probes, t, Math.min(1, t / duration)));
      if (i % 20 === 0) {
        onProgress(i / steps);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    onProgress(1);
    return out;
  }
  const video = media;
  video.pause();
  const duration = Math.min(EXPORT_MAX_SECONDS, video.duration || scene.media.duration);
  const steps = Math.floor(duration / EXPORT_STEP);
  for (let i = 0; i <= steps; i++) {
    const t = Math.min(duration - 0.01, i * EXPORT_STEP);
    await seek(video, t, signal);
    const img = source.capture(video);
    if (img) out.push(analyzer.analyse(img, probes, t));
    onProgress(i / steps);
  }
  return out;
}
