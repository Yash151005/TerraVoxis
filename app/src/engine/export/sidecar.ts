import type { ProbeSpec, Scene } from '../../scenes/types';
import { CONSTANTS } from '../mapping/constants';
import { MODES, type ModeConfig } from '../mapping/modes';

export const APP_VERSION = '1.0.0';
export const HONESTY_STATEMENT =
  'Values are estimated from pixel colour in a NASA SVS rendering and are not measurements.';

export const SIDECAR_FIELDS = [
  'appVersion',
  'scene',
  'mode',
  'settings',
  'probes',
  'constants',
  'lut',
  'provenance',
  'statement',
] as const;

export function buildSidecar(scene: Scene, mode: ModeConfig, probes: ProbeSpec[], durationSeconds: number) {
  return {
    appVersion: APP_VERSION,
    generated: new Date().toISOString(),
    scene: { id: scene.id, title: scene.title, svsId: scene.svsId, svsUrl: scene.svsUrl, quantity: scene.quantity },
    mode: mode.mode,
    settings: {
      polarity: mode.polarity === 1 ? 'higher pitch means more' : 'higher pitch means less',
      streams: mode.streams,
      probeOnly: mode.probeOnly,
      referenceU: mode.referenceU,
      smoothingTauSeconds: MODES[mode.mode].tau,
      pitch: MODES[mode.mode].pitch,
      musical: scene.musical,
      match: scene.match,
      exportStepSeconds: 0.1,
      durationSeconds,
      sampleRate: 44100,
    },
    probes: probes.map((p, i) => ({ number: i + 1, x: p.x, y: p.y, r: p.r })),
    constants: CONSTANTS,
    lut: scene.lut,
    provenance: scene.provenance,
    statement: HONESTY_STATEMENT,
    credit: "Visualization by NASA's Scientific Visualization Studio. TerraVoxis is not affiliated with or endorsed by NASA.",
  };
}

export function sidecarBlob(sidecar: ReturnType<typeof buildSidecar>): Blob {
  return new Blob([JSON.stringify(sidecar, null, 2)], { type: 'application/json' });
}
