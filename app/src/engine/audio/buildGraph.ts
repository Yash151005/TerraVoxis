import type { VoiceTargets } from '../types';
import { MASTER_CEILING, MAX_EVENT_VOICES, REFERENCE_DB } from '../mapping/constants';
import { midiToFreq } from '../mapping/scales';
import { impulseResponse, noiseBuffer } from './noise';
import {
  createBed,
  createClassVoice,
  createEventVoice,
  createProbeVoice,
  type BedVoice,
  type ClassVoice,
  type EventVoice,
  type ProbeVoice,
} from './voices';

export type Graph = {
  ctx: BaseAudioContext;
  probes: ProbeVoice[];
  bed: BedVoice;
  events: EventVoice[];
  classes: Map<string, ClassVoice>;
  ref: { osc: OscillatorNode; env: GainNode };
  mix: GainNode;
  reverbSend: GainNode;
  master: GainNode;
  limiter: DynamicsCompressorNode;
  analyser: AnalyserNode | null;
};

const TC = 0.04; // time constant for continuous parameters

/**
 * Section 9.1. One graph builder for both AudioContext and OfflineAudioContext.
 * mix bus -> high-pass 40 Hz -> (reverb send) -> master gain -> limiter -> destination.
 */
export function buildGraph(ctx: BaseAudioContext, classIds: string[] = [], opts: { analyser?: boolean } = {}): Graph {
  const mix = ctx.createGain();
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 40;
  const master = ctx.createGain();
  master.gain.value = MASTER_CEILING;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  limiter.knee.value = 0;
  mix.connect(hp).connect(master).connect(limiter).connect(ctx.destination);

  const reverbSend = ctx.createGain();
  reverbSend.gain.value = 0;
  const conv = ctx.createConvolver();
  conv.buffer = impulseResponse(ctx);
  hp.connect(reverbSend).connect(conv).connect(master);

  let analyser: AnalyserNode | null = null;
  if (opts.analyser) {
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    limiter.connect(analyser);
  }

  const probes = [createProbeVoice(ctx, 0, mix), createProbeVoice(ctx, 1, mix)];
  const bed = createBed(ctx, mix);
  const events = Array.from({ length: MAX_EVENT_VOICES }, () => createEventVoice(ctx, mix));
  const noise = noiseBuffer(ctx);
  const classes = new Map<string, ClassVoice>();
  classIds.forEach((id, k) => classes.set(id, createClassVoice(ctx, id, k, noise, mix)));

  const refOsc = ctx.createOscillator();
  refOsc.type = 'sine';
  const refEnv = ctx.createGain();
  refEnv.gain.value = 0;
  refOsc.connect(refEnv).connect(mix);
  refOsc.start();

  return { ctx, probes, bed, events, classes, ref: { osc: refOsc, env: refEnv }, mix, reverbSend, master, limiter, analyser };
}

const set = (p: AudioParam, v: number, time: number, tc = TC) => p.setTargetAtTime(v, time, tc);

/** Section 9.3: schedule targets at `time`. */
export function applyTargets(graph: Graph, t: VoiceTargets, time: number) {
  t.probe.forEach((p, i) => {
    const v = graph.probes[i];
    if (!v) return;
    v.oscs[0].frequency.setTargetAtTime(p.freq, time, 0.03);
    if (v.oscs[1]) v.oscs[1].frequency.setTargetAtTime(2 * p.freq, time, 0.03);
    if (v.colour) set(v.colour.frequency, 2.5 * p.freq, time);
    set(v.filter.frequency, Math.min(18000, p.cutoff), time);
    set(v.gain.gain, p.gain, time);
    set(v.pan.pan, p.pan, time);
    set(v.lfoDepth.gain, p.tremolo / 2, time);
    set(v.tremolo.gain, 1 - p.tremolo / 2, time);
  });
  // Musical note envelope: a short dip and re-attack, then decay to a sustain level.
  const noteVoices = new Set((t.noteOn ?? []).map((n) => n.voice));
  graph.probes.forEach((v, i) => {
    if (noteVoices.has(i)) {
      const n = t.noteOn!.find((x) => x.voice === i)!;
      const f = midiToFreq(n.midi);
      v.oscs[0].frequency.setTargetAtTime(f, time + 0.008, 0.004);
      if (v.oscs[1]) v.oscs[1].frequency.setTargetAtTime(2 * f, time + 0.008, 0.004);
      v.env.gain.setTargetAtTime(0.15, time, 0.004);
      v.env.gain.setTargetAtTime(1, time + 0.012, 0.005);
      v.env.gain.setTargetAtTime(0.55, time + 0.06, 0.25);
    } else if (!t.noteEnvelope) {
      set(v.env.gain, 1, time);
    }
  });

  set(graph.bed.gain.gain, t.bed.gain, time);
  graph.bed.oscs.forEach((o) => o.frequency.setTargetAtTime(t.bed.freq, time, 0.08));
  set(graph.bed.filter.frequency, t.bed.cutoff, time);

  if (t.classes) {
    for (const [id, level] of Object.entries(t.classes)) {
      const v = graph.classes.get(id);
      if (v) set(v.gain.gain, level, time, 0.08);
    }
  }

  for (const h of t.hits) triggerEvent(graph, h, time);

  if (t.refClick) {
    const { osc, env } = graph.ref;
    const level = 0.5 * 10 ** (REFERENCE_DB / 20);
    osc.frequency.setValueAtTime(t.refClick.freq, time);
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(level, time + 0.01);
    env.gain.setValueAtTime(level, time + 0.03);
    env.gain.linearRampToValueAtTime(0, time + 0.04);
  }

  set(graph.reverbSend.gain, t.reverb, time, 0.1);
}

/** Start an event from the pool of 8; steal the oldest when all are busy. */
export function triggerEvent(graph: Graph, h: { freq: number; gain: number; pan: number }, time: number) {
  let v = graph.events[0];
  for (const e of graph.events) if (e.startedAt < v.startedAt) v = e;
  v.startedAt = time;
  const peak = 0.35 * h.gain;
  v.osc.frequency.setValueAtTime(h.freq, time);
  v.bright.frequency.setValueAtTime(2 * h.freq, time);
  v.pan.pan.setValueAtTime(h.pan, time);
  v.env.gain.cancelScheduledValues(time);
  v.env.gain.setValueAtTime(0.0001, time);
  v.env.gain.linearRampToValueAtTime(peak, time + 0.004);
  v.env.gain.exponentialRampToValueAtTime(0.0001, time + 0.144);
  v.env.gain.setValueAtTime(0, time + 0.15);
  v.brightEnv.gain.cancelScheduledValues(time);
  v.brightEnv.gain.setValueAtTime(0.0001, time);
  v.brightEnv.gain.linearRampToValueAtTime(peak * 0.35, time + 0.004);
  v.brightEnv.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
  v.brightEnv.gain.setValueAtTime(0, time + 0.035);
}

/** Ramp every continuous voice to silence (seek, stop). */
export function silenceVoices(graph: Graph, time: number, tc = 0.01) {
  graph.probes.forEach((v) => set(v.gain.gain, 0, time, tc));
  set(graph.bed.gain.gain, 0, time, tc);
  graph.classes.forEach((v) => set(v.gain.gain, 0, time, tc));
}
