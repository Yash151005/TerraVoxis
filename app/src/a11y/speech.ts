/** Opt-in speech through speechSynthesis, split into sentences. */

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Make units readable aloud. */
const speakable = (s: string) => s.replace(/°C/g, ' degrees Celsius').replace(/°/g, ' degrees');

export function cancelSpeech() {
  if (speechSupported()) window.speechSynthesis.cancel();
}

export function speak(text: string, signal?: AbortSignal): Promise<void> {
  if (!speechSupported()) return Promise.resolve();
  const synth = window.speechSynthesis;
  synth.cancel();
  const parts = splitSentences(text);
  return new Promise((resolve) => {
    let i = 0;
    const next = () => {
      if (signal?.aborted || i >= parts.length) return resolve();
      const u = new SpeechSynthesisUtterance(speakable(parts[i++]));
      u.lang = 'en';
      u.rate = 1.05;
      u.onend = next;
      u.onerror = () => resolve();
      synth.speak(u);
    };
    signal?.addEventListener('abort', () => {
      synth.cancel();
      resolve();
    });
    next();
  });
}
