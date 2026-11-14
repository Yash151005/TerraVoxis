/** Timbre recipes of section 9.2. Every source starts at once and runs silently until its gain rises. */

export type ProbeVoice = {
  oscs: OscillatorNode[];
  partialGains: GainNode[];
  /** Probe 2 only: low-pass that tracks 2.5 f. */
  colour: BiquadFilterNode | null;
  filter: BiquadFilterNode;
  /** Musical note envelope (1 outside Musical mode). */
  env: GainNode;
  tremolo: GainNode;
  lfoDepth: GainNode;
  lfo: OscillatorNode;
  gain: GainNode;
  pan: StereoPannerNode;
};

const osc = (ctx: BaseAudioContext, type: OscillatorType, freq: number, detune = 0) => {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  return o;
};

const gainNode = (ctx: BaseAudioContext, v: number) => {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
};

const lowpass = (ctx: BaseAudioContext, f: number, q = 0.7) => {
  const b = ctx.createBiquadFilter();
  b.type = 'lowpass';
  b.frequency.value = f;
  b.Q.value = q;
  return b;
};

/**
 * Probe 1: triangle plus a sine one octave up at 20%.
 * Probe 2: square through a low-pass at 2.5 f, at 60% level.
 */
export function createProbeVoice(ctx: BaseAudioContext, which: 0 | 1, out: AudioNode): ProbeVoice {
  const f0 = 220;
  const filter = lowpass(ctx, 4 * f0);
  const env = gainNode(ctx, 1);
  const tremolo = gainNode(ctx, 1);
  const lfo = osc(ctx, 'sine', 6);
  const lfoDepth = gainNode(ctx, 0);
  lfo.connect(lfoDepth).connect(tremolo.gain);
  const gain = gainNode(ctx, 0);
  const pan = ctx.createStereoPanner();
  filter.connect(env).connect(tremolo).connect(gain).connect(pan).connect(out);
  let oscs: OscillatorNode[];
  let partialGains: GainNode[];
  let colour: BiquadFilterNode | null = null;
  if (which === 0) {
    const a = osc(ctx, 'triangle', f0);
    const b = osc(ctx, 'sine', 2 * f0);
    const ga = gainNode(ctx, 1);
    const gb = gainNode(ctx, 0.2);
    a.connect(ga).connect(filter);
    b.connect(gb).connect(filter);
    oscs = [a, b];
    partialGains = [ga, gb];
  } else {
    const a = osc(ctx, 'square', f0);
    colour = lowpass(ctx, 2.5 * f0);
    const ga = gainNode(ctx, 0.6);
    a.connect(colour).connect(ga).connect(filter);
    oscs = [a];
    partialGains = [ga];
  }
  [...oscs, lfo].forEach((o) => o.start());
  return { oscs, partialGains, colour, filter, env, tremolo, lfoDepth, lfo, gain, pan };
}

export type BedVoice = { oscs: OscillatorNode[]; filter: BiquadFilterNode; gain: GainNode };

/** Two sawtooth oscillators detuned by +/-6 cents, low-passed. */
export function createBed(ctx: BaseAudioContext, out: AudioNode): BedVoice {
  const filter = lowpass(ctx, 300);
  const gain = gainNode(ctx, 0);
  const a = osc(ctx, 'sawtooth', 65.4, -6);
  const b = osc(ctx, 'sawtooth', 65.4, 6);
  const mix = gainNode(ctx, 0.5);
  a.connect(mix);
  b.connect(mix);
  mix.connect(filter).connect(gain).connect(out);
  a.start();
  b.start();
  return { oscs: [a, b], filter, gain };
}

export type EventVoice = { osc: OscillatorNode; env: GainNode; bright: OscillatorNode; brightEnv: GainNode; pan: StereoPannerNode; startedAt: number };

/** Sine with a 4 ms attack and 140 ms exponential decay, plus a triangle at 2 f for the first 30 ms. */
export function createEventVoice(ctx: BaseAudioContext, out: AudioNode): EventVoice {
  const o = osc(ctx, 'sine', 880);
  const bright = osc(ctx, 'triangle', 1760);
  const env = gainNode(ctx, 0);
  const brightEnv = gainNode(ctx, 0);
  const pan = ctx.createStereoPanner();
  o.connect(env).connect(pan);
  bright.connect(brightEnv).connect(pan);
  pan.connect(out);
  o.start();
  bright.start();
  return { osc: o, env, bright, brightEnv, pan, startedAt: -Infinity };
}

export type ClassVoice = { id: string; gain: GainNode; sources: AudioScheduledSourceNode[] };

/** Class voice recipes for the aerosol classes; unknown classes get a plain sine. */
export function createClassVoice(ctx: BaseAudioContext, id: string, index: number, noise: AudioBuffer, out: AudioNode): ClassVoice {
  const gain = gainNode(ctx, 0);
  gain.connect(out);
  const sources: AudioScheduledSourceNode[] = [];
  const noiseSrc = (level: number, dest: AudioNode) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    s.loop = true;
    s.connect(gainNode(ctx, level)).connect(dest);
    sources.push(s);
    return s;
  };
  if (id === 'seaSalt') {
    // Looping white noise through a band-pass at 1800 Hz, Q 0.7.
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.7;
    bp.connect(gainNode(ctx, 0.9)).connect(gain);
    noiseSrc(1, bp);
  } else if (id === 'dust') {
    // Sawtooth at 110 Hz through a low-pass at 500 Hz, with slow 0.3 Hz amplitude wobble.
    const s = osc(ctx, 'sawtooth', 110);
    const lp = lowpass(ctx, 500);
    const wob = gainNode(ctx, 0.7);
    const lfo = osc(ctx, 'sine', 0.3);
    lfo.connect(gainNode(ctx, 0.3)).connect(wob.gain);
    s.connect(lp).connect(wob).connect(gain);
    sources.push(s, lfo);
  } else if (id === 'blackCarbon') {
    // Two sines at 82 and 87 Hz (a slow beat), plus low-passed noise at 15%.
    const a = osc(ctx, 'sine', 82);
    const b = osc(ctx, 'sine', 87);
    const mix = gainNode(ctx, 0.85);
    a.connect(mix);
    b.connect(mix);
    mix.connect(gain);
    const lp = lowpass(ctx, 400);
    lp.connect(gain);
    noiseSrc(0.15, lp);
    sources.push(a, b);
  } else if (id === 'sulfate') {
    // Sines at 880, 1320 and 1760 Hz with staggered slow tremolo.
    [880, 1320, 1760].forEach((f, k) => {
      const s = osc(ctx, 'sine', f);
      const g = gainNode(ctx, 0.14);
      const lfo = osc(ctx, 'sine', 0.2 + 0.13 * k);
      lfo.connect(gainNode(ctx, 0.1)).connect(g.gain);
      s.connect(g).connect(gain);
      sources.push(s, lfo);
    });
  } else {
    const s = osc(ctx, 'sine', 220 * 2 ** (index / 4));
    s.connect(gainNode(ctx, 0.5)).connect(gain);
    sources.push(s);
  }
  sources.forEach((s) => s.start());
  return { id, gain, sources };
}
