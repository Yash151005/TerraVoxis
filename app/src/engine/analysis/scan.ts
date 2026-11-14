/** Section 7.6: scan mode for still images. */

export const SCAN_DEFAULT_SECONDS = 24;
export const SCAN_BAND_FRACTION = 0.03;

export const scanPosition = (t: number, duration = SCAN_DEFAULT_SECONDS) => Math.min(1, Math.max(0, t / duration));

/** Pixel columns [x0, x1) of the band, 3% of the width, centred on the playhead. */
export function scanBand(scanX: number, width: number): [number, number] {
  const half = Math.max(0.5, (SCAN_BAND_FRACTION * width) / 2);
  const centre = scanX * width;
  const x0 = Math.max(0, Math.floor(centre - half));
  const x1 = Math.min(width, Math.max(x0 + 1, Math.ceil(centre + half)));
  return [x0, x1];
}
