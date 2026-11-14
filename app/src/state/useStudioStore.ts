import { create } from 'zustand';
import type { FrameFeatures } from '../engine/types';
import { defaultStreams, type ModeName, type StreamToggles } from '../engine/mapping/modes';
import type { ProbeSpec } from '../scenes/types';

export type MediaState = 'loading' | 'ready' | 'error';

type StudioStore = {
  sceneId: string | null;
  probes: ProbeSpec[];
  mode: ModeName;
  polarity: 1 | -1;
  streams: StreamToggles;
  probeOnly: boolean;
  playing: boolean;
  time: number;
  duration: number;
  rate: number;
  muted: boolean;
  legendPlaying: boolean;
  mediaState: MediaState;
  lutError: string | null;
  /** Latest smoothed features, refreshed a few times per second for the readout. */
  readout: FrameFeatures | null;
  /** Probe index that has just moved, to announce on key release. */
  set: (patch: Partial<Omit<StudioStore, 'set' | 'reset' | 'setMode' | 'moveProbe' | 'toggleStream'>>) => void;
  reset: (sceneId: string, probes: ProbeSpec[], mode: ModeName, polarity: 1 | -1) => void;
  setMode: (mode: ModeName) => void;
  moveProbe: (i: number, x: number, y: number) => void;
  toggleStream: (k: keyof StreamToggles, on: boolean) => void;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const useStudioStore = create<StudioStore>()((set) => ({
  sceneId: null,
  probes: [],
  mode: 'scientific',
  polarity: 1,
  streams: defaultStreams('scientific'),
  probeOnly: false,
  playing: false,
  time: 0,
  duration: 0,
  rate: 1,
  muted: false,
  legendPlaying: false,
  mediaState: 'loading',
  lutError: null,
  readout: null,
  set: (patch) => set(patch),
  reset: (sceneId, probes, mode, polarity) =>
    set({
      sceneId,
      probes: probes.map((p) => ({ ...p })),
      mode,
      polarity,
      streams: defaultStreams(mode),
      probeOnly: false,
      playing: false,
      time: 0,
      duration: 0,
      rate: 1,
      legendPlaying: false,
      mediaState: 'loading',
      lutError: null,
      readout: null,
    }),
  setMode: (mode) => set({ mode, streams: defaultStreams(mode) }),
  moveProbe: (i, x, y) =>
    set((s) => ({ probes: s.probes.map((p, k) => (k === i ? { ...p, x: clamp01(x), y: clamp01(y) } : p)) })),
  toggleStream: (k, on) => set((s) => ({ streams: { ...s.streams, [k]: on } })),
}));
