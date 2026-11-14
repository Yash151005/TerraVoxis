import type { Lut, Manifest } from './types';
import { asLut, asManifest } from './validate';

export const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;

let cache: Promise<Manifest> | null = null;

export function loadManifest(): Promise<Manifest> {
  if (!cache) {
    cache = fetch(assetUrl('scenes/manifest.json'))
      .then((r) => {
        if (!r.ok) throw new Error(`The scene list could not be loaded (HTTP ${r.status}).`);
        return r.json();
      })
      .then(asManifest)
      .catch((e: unknown) => {
        cache = null;
        throw e instanceof Error ? e : new Error(String(e));
      });
  }
  return cache;
}

export async function loadLut(path: string): Promise<Lut> {
  const r = await fetch(assetUrl(path));
  if (!r.ok) throw new Error(`The colour legend table could not be loaded (HTTP ${r.status}).`);
  return asLut(await r.json());
}
