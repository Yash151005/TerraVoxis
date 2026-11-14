/** Value with unit, e.g. "16 °C". Whole numbers for ranges of 10 or more, else one decimal. */
export function formatValue(v: number, unit: string, span = 32): string {
  const digits = span >= 10 ? 0 : 1;
  const num = v.toFixed(digits).replace(/^-0$/, '0');
  return unit ? `${num} ${unit}` : num;
}

export function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function spokenTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m ? `${m} minute${m === 1 ? '' : 's'} ${sec} second${sec === 1 ? '' : 's'}` : `${sec} second${sec === 1 ? '' : 's'}`;
}

export function confidenceWord(c: number): 'high' | 'medium' | 'low' {
  return c >= 0.6 ? 'high' : c >= 0.3 ? 'medium' : 'low';
}

export const pct = (v: number) => `${Math.round(v * 100)}%`;
