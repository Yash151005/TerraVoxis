import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Analyzer, createAnalysisContext, type AnalysisContext } from '../engine/analysis/features';
import { FrameSource } from '../engine/analysis/frameSource';
import { FeatureSmoother, valuesFromU } from '../engine/analysis/smoothing';
import { audioEngine } from '../engine/audio/engine';
import { HapticPlanner, vibrate } from '../engine/haptics/haptics';
import { initialMappingState, mapFeatures } from '../engine/mapping/mapFeatures';
import { MODES, type ModeConfig } from '../engine/mapping/modes';
import type { FrameFeatures, SceneEvent } from '../engine/types';
import type { Lut, Scene } from '../scenes/types';
import type { MediaClock } from './clock';
import { useSettingsStore } from './useSettingsStore';
import { useStudioStore } from './useStudioStore';

export const ANALYSIS_INTERVAL_MS = 50; // at most 20 analyses per second
const READOUT_INTERVAL_MS = 200;

export type Perf = { count: number; meanMs: number; maxMs: number; last: number[] };

export type SonificationHandle = {
  ctx: AnalysisContext | null;
  /** Latest smoothed features. */
  latest: React.RefObject<FrameFeatures | null>;
  /** Smoothed u of each probe over the last ~3 s, for trends. */
  history: React.RefObject<{ at: number; u: (number | null)[] }[]>;
  /** Events detected over the last second. */
  recentEvents: React.RefObject<{ at: number; e: SceneEvent }[]>;
  perf: React.RefObject<Perf>;
  /** Analyse once now, even if paused (after a seek or a probe move). */
  refresh: () => void;
};

export function modeConfigFromStore(): ModeConfig {
  const s = useStudioStore.getState();
  return { mode: s.mode, polarity: s.polarity, streams: s.streams, probeOnly: s.probeOnly, referenceU: 0.5 };
}

/**
 * The live loop: video clock -> analysis canvas -> features -> smoothing -> mapFeatures -> audio.
 * Targets are applied at ctx.currentTime + 0.02 for each analysed frame.
 */
export function useSonification(
  scene: Scene,
  lut: Lut | null | undefined,
  media: HTMLVideoElement | HTMLImageElement | null,
  clock: MediaClock | null,
): SonificationHandle {
  const ctx = useMemo(() => (lut === undefined ? null : createAnalysisContext(scene, lut)), [scene, lut]);
  const latest = useRef<FrameFeatures | null>(null);
  const history = useRef<{ at: number; u: (number | null)[] }[]>([]);
  const recentEvents = useRef<{ at: number; e: SceneEvent }[]>([]);
  const perf = useRef<Perf>({ count: 0, meanMs: 0, maxMs: 0, last: [] });
  const pending = useRef(true);
  const analyseRef = useRef<(t: number, force: boolean) => void>(() => {});

  // Class voices exist only for categorical scenes.
  useEffect(() => {
    audioEngine.setScene(ctx?.inverter.classIds ?? []);
  }, [ctx]);

  useEffect(() => {
    if (!ctx || !media || !clock) return;
    const source = new FrameSource(ctx.width, ctx.height);
    const analyzer = new Analyzer(ctx);
    const smoother = new FeatureSmoother(MODES[useStudioStore.getState().mode].tau);
    const haptics = new HapticPlanner();
    let mapState = initialMappingState();
    let lastAnalysis = -Infinity;
    let lastReadout = -Infinity;
    let stopped = false;
    const q = scene.quantity;
    const isScan = clock.kind === 'scan';
    const scanDuration = clock.duration;

    const analyse = (t: number, force: boolean) => {
      if (stopped || document.hidden) return;
      const playing = !clock.paused;
      if (!playing && !force && !pending.current) return;
      const now = performance.now();
      if (!force && !pending.current && now - lastAnalysis < ANALYSIS_INTERVAL_MS) return;
      const img = source.capture(media);
      if (!img) return;
      pending.current = false;
      lastAnalysis = now;
      const s = useStudioStore.getState();
      smoother.tau = MODES[s.mode].tau;
      const t0 = performance.now();
      const raw = analyzer.analyse(img, s.probes, t, isScan ? Math.min(1, t / scanDuration) : undefined);
      const dt = performance.now() - t0;
      const p = perf.current;
      p.count++;
      p.meanMs += (dt - p.meanMs) / p.count;
      p.maxMs = Math.max(p.maxMs, dt);
      p.last.push(dt);
      if (p.last.length > 200) p.last.shift();
      // While paused there is no elapsed media time; treat a refresh as fully settled so moves show at once.
      const f = valuesFromU(smoother.step(raw, playing ? undefined : 10), q.vmin, q.vmax, q.kind === 'continuous');
      const r = mapFeatures(f, scene, modeConfigFromStore(), mapState);
      mapState = r.state;
      if (playing) audioEngine.apply(r.targets);
      if (playing && useSettingsStore.getState().haptics) {
        const pattern = haptics.step(f, raw.events.length, now);
        if (pattern) vibrate(pattern);
      }
      latest.current = f;
      history.current.push({ at: now, u: f.probes.map((x) => x.u) });
      while (history.current.length && now - history.current[0].at > 3000) history.current.shift();
      for (const e of raw.events) recentEvents.current.push({ at: now, e });
      while (recentEvents.current.length && now - recentEvents.current[0].at > 1000) recentEvents.current.shift();
      if (force || now - lastReadout > READOUT_INTERVAL_MS) {
        lastReadout = now;
        useStudioStore.setState({ readout: f });
      }
    };
    analyseRef.current = analyse;

    // Frame timing: requestVideoFrameCallback where available, else requestAnimationFrame.
    const video = media instanceof HTMLVideoElement ? media : null;
    let rafId = 0;
    let vfcId = 0;
    const useVfc = !!video && 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
    const onVfc = (_now: number, meta: VideoFrameCallbackMetadata) => {
      analyse(meta.mediaTime, false);
      vfcId = video!.requestVideoFrameCallback(onVfc);
    };
    const onRaf = () => {
      analyse(clock.time, false);
      rafId = requestAnimationFrame(onRaf);
    };
    if (useVfc) vfcId = video!.requestVideoFrameCallback(onVfc);
    else rafId = requestAnimationFrame(onRaf);

    const reset = () => {
      audioEngine.silence();
      smoother.reset();
      analyzer.reset();
      haptics.reset();
      mapState = initialMappingState();
      history.current = [];
      recentEvents.current = [];
      pending.current = true;
    };
    const offs = [
      clock.on('play', () => {
        useStudioStore.setState({ playing: true });
        audioEngine.setGate('media', true);
      }),
      clock.on('pause', () => {
        useStudioStore.setState({ playing: false });
        audioEngine.setGate('media', false);
      }),
      clock.on('seeking', reset),
      clock.on('seeked', () => {
        pending.current = true;
        // Paused video: no new frame callback will come, so analyse directly.
        if (clock.paused) setTimeout(() => analyse(clock.time, true), 30);
      }),
      clock.on('timeupdate', () => useStudioStore.setState({ time: clock.time })),
      clock.on('ended', () => useStudioStore.setState({ playing: false, time: clock.time })),
    ];
    // Probe moves while paused refresh the readout.
    const unsub = useStudioStore.subscribe((s, prev) => {
      if (s.probes !== prev.probes || s.probeOnly !== prev.probeOnly) {
        pending.current = true;
        if (clock.paused) analyse(clock.time, true);
      }
    });
    // A first reading once the media can be drawn.
    const first = setTimeout(() => analyse(clock.time, true), 50);

    const w = window as unknown as { __terravoxis?: Record<string, unknown> };
    w.__terravoxis = { ...(w.__terravoxis ?? {}), engine: audioEngine, latest, perf, sceneId: scene.id, store: useStudioStore };

    return () => {
      stopped = true;
      clearTimeout(first);
      if (rafId) cancelAnimationFrame(rafId);
      if (vfcId && video) video.cancelVideoFrameCallback(vfcId);
      offs.forEach((o) => o());
      unsub();
      audioEngine.setGate('media', false);
      audioEngine.silence();
    };
  }, [ctx, media, clock, scene]);

  const refresh = useCallback(() => {
    pending.current = true;
    if (clock) analyseRef.current(clock.time, true);
  }, [clock]);

  return { ctx, latest, history, recentEvents, perf, refresh };
}
