import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ModeName } from '../engine/mapping/modes';

export const SETTINGS_KEY = 'terravoxis.settings.v1';

export type Settings = {
  speech: boolean;
  shortcuts: boolean;
  highContrast: boolean;
  /** 'system' follows prefers-reduced-motion. */
  reducedMotion: 'system' | 'on' | 'off';
  defaultMode: ModeName;
  polarity: 1 | -1;
  volume: number;
  /** Vibration cues on supported phones (Android Chrome). Opt-in. */
  haptics: boolean;
};

type SettingsStore = Settings & {
  set: (patch: Partial<Settings>) => void;
};

export const DEFAULT_SETTINGS: Settings = {
  speech: false,
  shortcuts: true,
  highContrast: false,
  reducedMotion: 'system',
  defaultMode: 'scientific',
  polarity: 1,
  volume: 0.8,
  haptics: false,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
    }),
    {
      name: SETTINGS_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ set: _set, ...rest }) => rest,
    },
  ),
);

export function prefersReducedMotion(setting: Settings['reducedMotion']): boolean {
  if (setting === 'on') return true;
  if (setting === 'off') return false;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
