import { useCallback, useEffect, useState } from 'react';
import { loadManifest } from './loadManifest';
import type { Manifest } from './types';

export function useManifest() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    loadManifest()
      .then((m) => live && setManifest(m))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [attempt]);
  const retry = useCallback(() => {
    setError(null);
    setAttempt((a) => a + 1);
  }, []);
  return { manifest, error, retry };
}

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} — TerraVoxis` : 'TerraVoxis — Hear the data behind the picture';
  }, [title]);
}
