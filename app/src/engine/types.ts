export type ProbeFeatures = {
  x: number;
  y: number;
  r: number;
  /** In data units; null if coverage is too low. */
  value: number | null;
  /** Normalised 0..1; null if coverage is too low. */
  u: number | null;
  /** 0..1 fraction of valid pixels. */
  coverage: number;
  /** Standard deviation of u within the probe. */
  spread: number;
  /** 0..1 */
  motion: number;
  /** 0..1 */
  confidence: number;
  classFractions?: Record<string, number>;
};

export type SceneEvent = { x: number; y: number; strength: number };

export type GlobalFeatures = {
  u: number | null;
  coverage: number;
  motion: number;
  spread: number;
  classFractions?: Record<string, number>;
};

export type FrameFeatures = {
  /** Media time, seconds. */
  t: number;
  global: GlobalFeatures;
  probes: ProbeFeatures[];
  events: SceneEvent[];
  /** Scan mode playhead, 0..1. */
  scanX?: number;
};

export type ProbeTarget = { freq: number; gain: number; cutoff: number; pan: number; tremolo: number };

export type VoiceTargets = {
  probe: ProbeTarget[];
  bed: { freq: number; gain: number; cutoff: number };
  /** Class voice gains, 0..1. */
  classes?: Record<string, number>;
  hits: { freq: number; gain: number; pan: number }[];
  /** Musical mode: a new note starts on this voice. */
  noteOn?: { voice: number; midi: number }[];
  /** Reference tone click to play at this frequency. */
  refClick?: { freq: number } | null;
  /** Reverb send level (Musical only). */
  reverb: number;
  /** Musical mode: probe gain is shaped by a note envelope. */
  noteEnvelope: boolean;
};
