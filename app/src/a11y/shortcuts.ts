export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Space or K', action: 'Play or pause' },
  { keys: 'L', action: 'Play or stop the audio legend' },
  { keys: 'D', action: 'Describe this moment' },
  { keys: 'Arrow keys (probe focused)', action: 'Move the probe by 1%' },
  { keys: 'Shift + arrow keys (probe focused)', action: 'Move the probe by 5%' },
  { keys: 'Tab', action: 'Move between probes and controls' },
  { keys: '1, 2, 3', action: 'Scientific, Musical, Accessibility mode' },
  { keys: 'M', action: 'Mute or unmute' },
  { keys: 'Left and Right (seek slider focused)', action: 'Seek 5 seconds' },
  { keys: 'Escape', action: 'Stop the legend or close a dialog' },
  { keys: '?', action: 'Show this list' },
];

/** True when single-letter shortcuts must not fire: focus is in a text field or similar. */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset'].includes(type);
  }
  return false;
}
