/** One polite live region and one alert region; components subscribe. */

type Listener = (text: string, kind: 'status' | 'alert') => void;
const listeners = new Set<Listener>();
let lastAuto = -Infinity;
export const AUTO_INTERVAL_MS = 3000;

export function onAnnounce(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/**
 * Announce text in the polite live region. Automatic announcements are dropped if one was made
 * in the last 3 seconds; pass `requested: true` when the user asked for it.
 */
export function announce(text: string, opts: { requested?: boolean } = {}) {
  const now = performance.now();
  if (!opts.requested && now - lastAuto < AUTO_INTERVAL_MS) return false;
  if (!opts.requested) lastAuto = now;
  listeners.forEach((l) => l(text, 'status'));
  return true;
}

export function alertError(text: string) {
  listeners.forEach((l) => l(text, 'alert'));
}
