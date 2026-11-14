import type { Scene } from '../../scenes/types';
import type { FrameFeatures, ProbeTarget, VoiceTargets } from '../types';
import {
  ACCESSIBILITY_EVENTS_PER_FRAME,
  ALTERNATE_SECONDS,
  EVENT_F_LOW,
  EVENT_RATE_WINDOW,
  F_MAX,
  F_MIN,
  MAX_EVENT_VOICES,
  MAX_PROBE_VOICES,
  MIDI_MIN,
  MIDI_SPAN,
  REFERENCE_PERIOD,
  REVERB_SEND,
} from './constants';
import type { ModeConfig } from './modes';
import { midiToFreq, quantise, SCALES } from './scales';

export type MappingScene = Pick<Scene, 'quantity' | 'geo' | 'musical' | 'streams'>;

export type ProbeNoteState = { midi: number | null; lastU: number | null; pulse: number };

export type MappingState = {
  notes: ProbeNoteState[];
  /** Media times at which event voices were started, for rate limiting. */
  recentStarts: number[];
  lastRef: number | null;
  lastT: number | null;
};

export const initialMappingState = (): MappingState => ({
  notes: [
    { midi: null, lastU: null, pulse: -1 },
    { midi: null, lastU: null, pulse: -1 },
  ],
  recentStarts: [],
  lastRef: null,
  lastT: null,
});

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

/** Polarity: u' = u when +1, 1 - u when -1. */
export const polarise = (u: number, polarity: 1 | -1) => (polarity === 1 ? u : 1 - u);

/** Scientific pitch: exponential from F_MIN to F_MAX. */
export const scientificFreq = (u: number) => F_MIN * (F_MAX / F_MIN) ** clamp01(u);

/** Accessibility: u rounded to 8 equal steps, then the Scientific formula. */
export const steppedU = (u: number) => Math.round(clamp01(u) * 7) / 7;

export function musicalMidi(u: number, scene: MappingScene) {
  return quantise(MIDI_MIN + MIDI_SPAN * clamp01(u), scene.musical.scale, scene.musical.root, MIDI_MIN, MIDI_MIN + MIDI_SPAN);
}

/** Pitch of a polarised value u' in the given mode (Musical without note logic). */
export function pitchFor(uPrime: number, mode: ModeConfig['mode'], scene: MappingScene): number {
  if (mode === 'musical') return midiToFreq(musicalMidi(uPrime, scene));
  if (mode === 'accessibility') return scientificFreq(steppedU(uPrime));
  return scientificFreq(uPrime);
}

/** Equal-loudness trim. */
export const loudnessTrim = (f: number) => clamp((f / 440) ** -0.25, 0.6, 1.4);

const pan = (x: number) => 0.9 * (2 * clamp01(x) - 1);

const silentProbe = (x = 0.5): ProbeTarget => ({ freq: F_MIN, gain: 0, cutoff: 4 * F_MIN, pan: pan(x), tremolo: 0 });

const has = (scene: MappingScene, s: Scene['streams'][number]) => scene.streams.includes(s);

/** Frequency for an event at (x, y). Section 8.4. */
export function eventFreq(y: number, scene: MappingScene, mode: ModeConfig['mode']): number {
  let w = 1 - clamp01(y);
  let lat: number | null = null;
  if (scene.geo) {
    lat = scene.geo.north - clamp01(y) * (scene.geo.north - scene.geo.south);
    w = (lat - scene.geo.south) / (scene.geo.north - scene.geo.south);
  }
  if (mode === 'accessibility') {
    const band = lat !== null ? (lat < -23.44 ? 0 : lat <= 23.44 ? 1 : 2) : w < 1 / 3 ? 0 : w < 2 / 3 ? 1 : 2;
    return [midiToFreq(72), midiToFreq(79), midiToFreq(84)][band];
  }
  if (mode === 'musical') return midiToFreq(quantise(72 + 24 * w, scene.musical.scale, scene.musical.root, 72, 96));
  return EVENT_F_LOW * 4 ** w;
}

/**
 * Section 8: features to sound targets. Pure: never touches the audio context. Live
 * playback and export both call it.
 */
export function mapFeatures(
  features: FrameFeatures,
  scene: MappingScene,
  mode: ModeConfig,
  previous: MappingState,
): { targets: VoiceTargets; state: MappingState } {
  const t = features.t;
  const state: MappingState = {
    notes: previous.notes.map((n) => ({ ...n })),
    recentStarts: previous.recentStarts.filter((s) => s > t - EVENT_RATE_WINDOW && s <= t),
    lastRef: previous.lastRef,
    lastT: t,
  };
  // A jump backwards in time (seek) clears the timers.
  if (previous.lastT !== null && t < previous.lastT) {
    state.recentStarts = [];
    state.lastRef = null;
    state.notes.forEach((n) => Object.assign(n, { midi: null, lastU: null, pulse: -1 }));
  }
  const m = mode.mode;
  const kind = scene.quantity.kind;
  const sixteenth = 60 / scene.musical.bpm / 4;
  const halfStepU = 12 / SCALES[scene.musical.scale].length / 2 / MIDI_SPAN;

  // Probe voices (continuous scenes only).
  const probe: ProbeTarget[] = [];
  const noteOn: { voice: number; midi: number }[] = [];
  const probeStream = kind === 'continuous' && has(scene, 'probe') && mode.streams.probe;
  const n = Math.min(MAX_PROBE_VOICES, features.probes.length);
  const alternateActive = Math.floor(t / ALTERNATE_SECONDS) % Math.max(1, n);
  for (let i = 0; i < MAX_PROBE_VOICES; i++) {
    const p = features.probes[i];
    if (!p || !probeStream || p.u === null) {
      probe.push(silentProbe(p?.x));
      if (state.notes[i]) Object.assign(state.notes[i], { midi: null, lastU: null });
      continue;
    }
    const uP = polarise(p.u, mode.polarity);
    let freq: number;
    if (m === 'musical') {
      const ns = state.notes[i];
      const pulse = Math.floor(t / sixteenth);
      if (ns.midi === null) {
        ns.midi = musicalMidi(uP, scene);
        ns.lastU = uP;
        ns.pulse = pulse;
        noteOn.push({ voice: i, midi: ns.midi });
      } else if (pulse !== ns.pulse) {
        ns.pulse = pulse;
        const target = musicalMidi(uP, scene);
        if (target !== ns.midi && Math.abs(uP - (ns.lastU ?? uP)) > halfStepU) {
          ns.midi = target;
          ns.lastU = uP;
          noteOn.push({ voice: i, midi: target });
        }
      }
      freq = midiToFreq(ns.midi);
    } else {
      freq = pitchFor(uP, m, scene);
    }
    let gain = 0.5 * clamp01(p.coverage) ** 0.6 * loudnessTrim(freq);
    if (m === 'accessibility' && n > 1 && i !== alternateActive) gain = 0;
    const cutoff = m === 'accessibility' ? 4 * freq : Math.min(8000, freq * (2 + 6 * Math.min(1, p.spread / 0.25)));
    const motionOn = has(scene, 'motion') && mode.streams.motion;
    const tremolo = !motionOn ? 0 : m === 'scientific' ? 0.6 * p.motion : m === 'musical' ? 0.3 * p.motion : 0;
    probe.push({ freq, gain, cutoff, pan: pan(p.x), tremolo: clamp01(tremolo) });
  }

  // Bed.
  const g = features.global;
  const bedOn = has(scene, 'bed') && mode.streams.bed;
  let bed = { freq: F_MIN / 2, gain: 0, cutoff: 300 };
  if (bedOn && g.u !== null) {
    if (kind === 'event') {
      // Soft activity bed: a low drone on the root whose level follows how much lightning is on screen.
      bed = { freq: midiToFreq(scene.musical.root) / 2, gain: 0.12 * clamp01(g.u) ** 0.6, cutoff: 300 + 2500 * g.motion };
    } else {
      const f = pitchFor(polarise(g.u, mode.polarity), m, scene) / 2;
      bed = { freq: f, gain: 0.18 * clamp01(g.coverage) ** 0.6 * loudnessTrim(f * 2), cutoff: 300 + 2500 * g.motion };
    }
  }

  // Events.
  const hits: VoiceTargets['hits'] = [];
  if (has(scene, 'events') && mode.streams.events && features.events.length) {
    const room = Math.max(0, MAX_EVENT_VOICES - state.recentStarts.length);
    const cap = Math.min(room, m === 'accessibility' ? ACCESSIBILITY_EVENTS_PER_FRAME : MAX_EVENT_VOICES);
    const chosen = features.events
      .slice()
      .sort((a, b) => b.strength - a.strength)
      .slice(0, cap);
    for (const e of chosen) {
      hits.push({ freq: eventFreq(e.y, scene, m), gain: 0.25 + 0.5 * clamp01(e.strength), pan: pan(e.x) });
      state.recentStarts.push(t);
    }
  }

  // Class voices.
  let classes: Record<string, number> | undefined;
  if (kind === 'categorical' && has(scene, 'classes')) {
    const src = mode.probeOnly && features.probes[0]?.classFractions ? features.probes[0].classFractions : g.classFractions;
    classes = {};
    const entries = Object.entries(src ?? {});
    const top2 = entries
      .slice()
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([k]) => k);
    for (const [k, frac] of entries) {
      let level = mode.streams.classes ? 0.4 * clamp01(frac) ** 0.7 : 0;
      if (m === 'accessibility' && !top2.includes(k)) level = 0;
      classes[k] = level;
    }
  }

  // Reference tone.
  let refClick: VoiceTargets['refClick'] = null;
  if (mode.streams.reference && kind !== 'event') {
    if (state.lastRef === null || t - state.lastRef >= REFERENCE_PERIOD) {
      state.lastRef = t;
      refClick = { freq: pitchFor(polarise(mode.referenceU, mode.polarity), m, scene) };
    }
  } else {
    state.lastRef = null;
  }

  const targets: VoiceTargets = {
    probe,
    bed,
    hits,
    reverb: m === 'musical' ? REVERB_SEND : 0,
    refClick,
    noteEnvelope: m === 'musical',
    ...(classes ? { classes } : {}),
    ...(noteOn.length ? { noteOn } : {}),
  };
  return { targets, state };
}
