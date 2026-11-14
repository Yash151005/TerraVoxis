import type { Geo } from '../scenes/types';

export function toLonLat(x: number, y: number, geo: Geo): { lon: number; lat: number } {
  return { lon: geo.west + x * (geo.east - geo.west), lat: geo.north - y * (geo.north - geo.south) };
}

/** "35° N, 140° E", rounded to whole degrees. */
export function formatLatLon(lat: number, lon: number): string {
  const la = Math.round(lat);
  let lo = Math.round(lon);
  if (lo > 180) lo -= 360;
  if (lo < -180) lo += 360;
  const ns = la === 0 ? '0°' : `${Math.abs(la)}° ${la > 0 ? 'N' : 'S'}`;
  const ew = lo === 0 || Math.abs(lo) === 180 ? `${Math.abs(lo)}°` : `${Math.abs(lo)}° ${lo > 0 ? 'E' : 'W'}`;
  return `${ns}, ${ew}`;
}

/** Spoken form: "55° north, 50° west". */
export function spokenLatLon(lat: number, lon: number): string {
  const la = Math.round(lat);
  const lo = Math.round(lon);
  const ns = la === 0 ? 'the equator' : `${Math.abs(la)}° ${la > 0 ? 'north' : 'south'}`;
  const ew = lo === 0 ? '0° longitude' : `${Math.abs(lo)}° ${lo > 0 ? 'east' : 'west'}`;
  return `${ns}, ${ew}`;
}

export function placeOf(x: number, y: number, geo: Geo | null): string | null {
  if (!geo) return null;
  const { lat, lon } = toLonLat(x, y, geo);
  return formatLatLon(lat, lon);
}
