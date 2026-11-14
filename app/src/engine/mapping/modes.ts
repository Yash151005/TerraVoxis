export type ModeName = 'scientific' | 'musical' | 'accessibility';

export type StreamToggles = {
  probe: boolean;
  bed: boolean;
  /** Motion shimmer (tremolo). */
  motion: boolean;
  events: boolean;
  classes: boolean;
  reference: boolean;
};

export type ModeConfig = {
  mode: ModeName;
  /** +1: higher pitch means more. -1: higher pitch means less. */
  polarity: 1 | -1;
  streams: StreamToggles;
  /** Categorical scenes: take class levels from probe 1 instead of the scan band. */
  probeOnly: boolean;
  /** Reference value as u, 0..1 (default: middle of the range). */
  referenceU: number;
};

export type ModeDefaults = {
  label: string;
  pitch: string;
  reverb: boolean;
  bed: boolean;
  tau: number;
  reference: boolean;
  probesTogether: boolean;
};

/** Section 8.6. */
export const MODES: Record<ModeName, ModeDefaults> = {
  scientific: { label: 'Scientific', pitch: 'Continuous', reverb: false, bed: true, tau: 0.15, reference: false, probesTogether: true },
  musical: { label: 'Musical', pitch: 'Scale-quantised', reverb: true, bed: true, tau: 0.15, reference: false, probesTogether: true },
  accessibility: { label: 'Accessibility', pitch: '8 steps', reverb: false, bed: false, tau: 0.3, reference: true, probesTogether: false },
};

export function defaultStreams(mode: ModeName): StreamToggles {
  const d = MODES[mode];
  return { probe: true, bed: d.bed, motion: true, events: true, classes: true, reference: d.reference };
}

export function defaultModeConfig(mode: ModeName = 'scientific'): ModeConfig {
  return { mode, polarity: 1, streams: defaultStreams(mode), probeOnly: false, referenceU: 0.5 };
}
