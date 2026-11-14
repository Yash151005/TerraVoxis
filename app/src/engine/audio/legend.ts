import type { Scene } from '../../scenes/types';
import { formatValue } from '../../lib/format';
import type { FrameFeatures } from '../types';
import { eventFreq, initialMappingState, mapFeatures, type MappingState } from '../mapping/mapFeatures';
import type { ModeConfig } from '../mapping/modes';
import type { AudioEngine } from './engine';

export type LegendIO = {
  announce: (text: string) => void;
  /** Resolves when the words have been spoken (or immediately when speech is off). */
  speak: (text: string) => Promise<void>;
  signal: AbortSignal;
  speechOn: boolean;
  classLabels: Record<string, string>;
};

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const id = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });

const probeFrame = (t: number, u: number | null, x = 0.5): FrameFeatures => ({
  t,
  global: { u: null, coverage: 0, motion: 0, spread: 0 },
  probes: [{ x, y: 0.5, r: 0.03, u, value: null, coverage: u === null ? 0 : 1, spread: 0, motion: 0, confidence: 1 }],
  events: [],
});

/** Words for the legend steps, also used by tests and the Method page. */
export function legendSteps(scene: Scene, classLabels: Record<string, string> = {}): string[] {
  const q = scene.quantity;
  if (q.kind === 'continuous') {
    const mid = (q.vmin + q.vmax) / 2;
    return [
      `Lowest: ${formatValue(q.vmin, q.unit)}`,
      `Middle: ${formatValue(mid, q.unit)}`,
      `Highest: ${formatValue(q.vmax, q.unit)}`,
      'Now a glide from lowest to highest.',
      'Louder means more data under the probe. Left and right follow west and east.',
    ];
  }
  if (q.kind === 'event') {
    return ['Lightning in the south', 'In the tropics', 'In the north', 'On the left, in the west', 'In the centre', 'On the right, in the east'];
  }
  return Object.values(classLabels);
}

/**
 * Section 8.8: a scripted sequence that uses the real synth voices. Each step updates the
 * live region and, if speech is on, speaks the label first. Stopped by aborting the signal.
 */
export async function playLegend(scene: Scene, mode: ModeConfig, engine: AudioEngine, io: LegendIO): Promise<void> {
  const { signal } = io;
  const mScene = { ...scene, streams: scene.streams.includes('probe') ? (['probe'] as Scene['streams']) : scene.streams };
  const legendMode: ModeConfig = {
    ...mode,
    streams: { probe: true, bed: false, motion: false, events: true, classes: true, reference: false },
    probeOnly: false,
  };
  let state: MappingState = initialMappingState();
  let clock = 0;
  const apply = (f: FrameFeatures) => {
    const r = mapFeatures(f, mScene, legendMode, state);
    state = r.state;
    engine.apply(r.targets);
  };
  const say = async (text: string) => {
    io.announce(text);
    if (io.speechOn) await io.speak(text);
    else await sleep(900, signal); // give a screen reader time to read the live region
  };
  const steps = legendSteps(scene, io.classLabels);
  engine.setGate('legend', true);
  try {
    const q = scene.quantity;
    if (q.kind === 'continuous') {
      const us = [0, 0.5, 1];
      for (let i = 0; i < 3; i++) {
        await say(steps[i]);
        clock += 1;
        apply(probeFrame(clock, us[i]));
        await sleep(800, signal);
        apply(probeFrame(clock + 0.8, null));
        await sleep(250, signal);
      }
      await say(steps[3]);
      const t0 = performance.now();
      for (;;) {
        const k = Math.min(1, (performance.now() - t0) / 2000);
        apply(probeFrame(clock + 1 + 2 * k, k));
        if (k >= 1) break;
        await sleep(40, signal);
      }
      apply(probeFrame(clock + 3.1, null));
      await sleep(300, signal);
      await say(steps[4]);
    } else if (q.kind === 'event') {
      const lat = (deg: number) => (scene.geo ? (scene.geo.north - deg) / (scene.geo.north - scene.geo.south) : 0.5 - deg / 90);
      const ys = [lat(-35), lat(0), lat(35)];
      for (let i = 0; i < 3; i++) {
        await say(steps[i]);
        for (let k = 0; k < 3; k++) {
          engine.hit({ freq: eventFreq(ys[i], scene, mode.mode), gain: 0.7, pan: 0 });
          await sleep(220, signal);
        }
        await sleep(300, signal);
      }
      const xs = [0.05, 0.5, 0.95];
      for (let i = 0; i < 3; i++) {
        await say(steps[3 + i]);
        for (let k = 0; k < 3; k++) {
          engine.hit({ freq: eventFreq(ys[1], scene, mode.mode), gain: 0.7, pan: 0.9 * (2 * xs[i] - 1) });
          await sleep(220, signal);
        }
        await sleep(300, signal);
      }
    } else {
      const ids = Object.keys(io.classLabels);
      for (const id of ids) {
        await say(io.classLabels[id]);
        const classes: Record<string, number> = {};
        ids.forEach((k) => (classes[k] = k === id ? 0.4 : 0));
        engine.apply({ probe: [], bed: { freq: 65, gain: 0, cutoff: 300 }, hits: [], classes, reverb: 0, noteEnvelope: false });
        await sleep(1000, signal);
        ids.forEach((k) => (classes[k] = 0));
        engine.apply({ probe: [], bed: { freq: 65, gain: 0, cutoff: 300 }, hits: [], classes, reverb: 0, noteEnvelope: false });
        await sleep(350, signal);
      }
    }
    io.announce('Legend finished.');
  } finally {
    engine.silence();
    engine.setGate('legend', false);
  }
}
