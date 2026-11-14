/** Section 8.1. */
export const F_MIN = 440 * 2 ** ((48 - 69) / 12); // C3, MIDI 48, 130.81 Hz
export const F_MAX = 440 * 2 ** ((84 - 69) / 12); // C6, MIDI 84, 1046.50 Hz
export const MIDI_MIN = 48;
export const MIDI_SPAN = 36;
export const MAX_PROBE_VOICES = 2;
export const MAX_EVENT_VOICES = 8;
/** Master ceiling: -6 dBFS before the limiter. */
export const MASTER_CEILING = 0.5;
export const EVENT_F_LOW = 440 * 2 ** ((72 - 69) / 12); // C5, 523.25 Hz
export const EVENT_RATE_WINDOW = 0.1; // s
export const ACCESSIBILITY_EVENTS_PER_FRAME = 4;
export const ALTERNATE_SECONDS = 1.2;
export const REFERENCE_PERIOD = 2;
export const REFERENCE_DB = -18;
export const REVERB_SEND = 0.18;

export const CONSTANTS = {
  F_MIN,
  F_MAX,
  bedRange: 'one octave below the probe range',
  maxProbeVoices: MAX_PROBE_VOICES,
  maxEventVoices: MAX_EVENT_VOICES,
  masterCeilingDbfs: -6,
  eventRange: 'C5 to C7 (523.25 to 2093 Hz)',
  referenceToneDb: REFERENCE_DB,
};
