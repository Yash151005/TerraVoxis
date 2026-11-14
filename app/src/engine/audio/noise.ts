import { mulberry32 } from '../../lib/prng';

/** Seeded white noise, so offline renders are identical. */
export function noiseBuffer(ctx: BaseAudioContext, seconds = 2, seed = 1234): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const rnd = mulberry32(seed);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = rnd() * 2 - 1;
  return buf;
}

/** Generated impulse response: seeded stereo noise with exponential decay. */
export function impulseResponse(ctx: BaseAudioContext, seconds = 1.6, seed = 99): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const rnd = mulberry32(seed + ch);
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * Math.exp((-5 * i) / len);
  }
  return buf;
}
