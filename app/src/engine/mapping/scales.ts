import type { ScaleName } from '../../scenes/types';

export const SCALES: Record<ScaleName, number[]> = {
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
};

export const midiToFreq = (m: number) => 440 * 2 ** ((m - 69) / 12);
export const freqToMidi = (f: number) => 69 + 12 * Math.log2(f / 440);

/** All MIDI notes of the scale (rooted at `root`, any octave) within [lo, hi]. */
export function scaleNotes(scale: ScaleName, root: number, lo: number, hi: number): number[] {
  const out: number[] = [];
  const pcs = SCALES[scale].map((o) => (((root + o) % 12) + 12) % 12);
  for (let m = Math.ceil(lo); m <= Math.floor(hi); m++) if (pcs.includes(((m % 12) + 12) % 12)) out.push(m);
  return out;
}

/** Nearest scale note to a (fractional) MIDI value, restricted to [lo, hi]. Ties go down. */
export function quantise(midi: number, scale: ScaleName, root: number, lo: number, hi: number): number {
  const notes = scaleNotes(scale, root, lo, hi);
  let best = notes[0];
  for (const n of notes) if (Math.abs(n - midi) < Math.abs(best - midi)) best = n;
  return best;
}

export const inScale = (midi: number, scale: ScaleName, root: number) =>
  SCALES[scale].map((o) => (((root + o) % 12) + 12) % 12).includes(((midi % 12) + 12) % 12);
