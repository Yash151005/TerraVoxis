export type Rect = { x: number; y: number; w: number; h: number };

export type Geo = {
  projection: 'equirectangular';
  west: number;
  east: number;
  north: number;
  south: number;
};

export type QuantityKind = 'continuous' | 'categorical' | 'event';
export type MatchMethod = 'lab' | 'hue' | 'categorical' | 'event';
export type ScaleName = 'majorPentatonic' | 'minorPentatonic' | 'dorian';
export type StreamName = 'probe' | 'bed' | 'motion' | 'events' | 'classes';

export type EventConfig = {
  hueMin: number;
  hueMax: number;
  minChroma: number;
  minLightness: number;
  grid: [number, number];
  maxPerFrame: number;
};

export type ProbeSpec = { x: number; y: number; r: number };

export type Scene = {
  id: string;
  svsId: number;
  title: string;
  tagline: string;
  svsUrl: string;
  media: {
    kind: 'video' | 'image';
    src: string;
    poster: string;
    width: number;
    height: number;
    duration: number;
  };
  transcode: { crf: number | null; trimmedSeconds: number | null; sourceFile: string };
  geo: Geo | null;
  quantity: { name: string; unit: string; vmin: number; vmax: number; kind: QuantityKind };
  match: { method: MatchMethod; minChroma: number; maxDistance: number };
  lut: string | null;
  masks: Rect[];
  analysis: { width: number; height: number };
  events: EventConfig | null;
  streams: StreamName[];
  musical: { scale: ScaleName; root: number; bpm: number };
  defaultProbes: ProbeSpec[];
  scan: { duration: number } | null;
  provenance: string;
  description: string;
  story: string;
  credits: string[];
};

export type Manifest = { version: number; generated: string; scenes: Scene[] };

export type ContinuousLut = {
  kind: 'continuous';
  n: number;
  vmin: number;
  vmax: number;
  rgb: [number, number, number][];
};

export type CategoricalLut = {
  kind: 'categorical';
  classes: { id: string; label: string; swatch?: [number, number, number]; rgb: [number, number, number][] }[];
};

export type Lut = ContinuousLut | CategoricalLut;
