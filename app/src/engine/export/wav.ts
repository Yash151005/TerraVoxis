/** 16-bit PCM WAV with a hand-written 44-byte header. */

export const NORMALISE_CEILING = 0.891; // -1 dBFS

export function peakOf(channels: Float32Array[]): number {
  let p = 0;
  for (const ch of channels) for (let i = 0; i < ch.length; i++) p = Math.max(p, Math.abs(ch[i]));
  return p;
}

export function encodeWavBytes(channels: Float32Array[], sampleRate: number): Uint8Array {
  const nCh = channels.length;
  const len = channels[0]?.length ?? 0;
  const peak = peakOf(channels);
  // Normalise only if the peak exceeds -1 dBFS.
  const scale = peak > NORMALISE_CEILING ? NORMALISE_CEILING / peak : 1;
  const dataBytes = len * nCh * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, nCh, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * nCh * 2, true); // byte rate
  v.setUint16(32, nCh * 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  str(36, 'data');
  v.setUint32(40, dataBytes, true);
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < nCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i] * scale));
      v.setInt16(o, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true);
      o += 2;
    }
  }
  return new Uint8Array(buf);
}

/** Decode our own WAV output (for tests and round-trip checks). */
export function decodeWavBytes(bytes: Uint8Array): { sampleRate: number; channels: Float32Array[] } {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const nCh = v.getUint16(22, true);
  const sampleRate = v.getUint32(24, true);
  const dataBytes = v.getUint32(40, true);
  const len = dataBytes / (2 * nCh);
  const channels = Array.from({ length: nCh }, () => new Float32Array(len));
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < nCh; c++) {
      const s = v.getInt16(o, true);
      channels[c][i] = s < 0 ? s / 0x8000 : s / 0x7fff;
      o += 2;
    }
  }
  return { sampleRate, channels };
}

export function encodeWav(buffer: AudioBuffer): Blob {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  return new Blob([encodeWavBytes(channels, buffer.sampleRate) as Uint8Array<ArrayBuffer>], { type: 'audio/wav' });
}
