/** The media clock: the video element for videos, a scan clock for stills. It is the only clock. */

export type ClockEvent = 'play' | 'pause' | 'seeking' | 'seeked' | 'timeupdate' | 'ended';

export interface MediaClock {
  readonly kind: 'video' | 'scan';
  readonly time: number;
  readonly duration: number;
  readonly paused: boolean;
  play(): Promise<void>;
  pause(): void;
  seek(t: number): void;
  setRate(r: number): void;
  on(ev: ClockEvent, cb: () => void): () => void;
}

export class VideoClock implements MediaClock {
  readonly kind = 'video' as const;
  readonly video: HTMLVideoElement;
  constructor(video: HTMLVideoElement) {
    this.video = video;
  }
  get time() {
    return this.video.currentTime;
  }
  get duration() {
    return Number.isFinite(this.video.duration) ? this.video.duration : 0;
  }
  get paused() {
    return this.video.paused;
  }
  play() {
    return this.video.play();
  }
  pause() {
    this.video.pause();
  }
  seek(t: number) {
    this.video.currentTime = Math.min(Math.max(0, t), Math.max(0, this.duration - 0.05));
  }
  setRate(r: number) {
    this.video.playbackRate = r;
  }
  on(ev: ClockEvent, cb: () => void) {
    this.video.addEventListener(ev, cb);
    return () => this.video.removeEventListener(ev, cb);
  }
}

/** Scan clock for still images: a playhead that sweeps west to east over `duration` seconds, then stops. */
export class ScanClock implements MediaClock {
  readonly kind = 'scan' as const;
  readonly duration: number;
  private t = 0;
  private playing = false;
  private rate = 1;
  private last = 0;
  private listeners = new Map<ClockEvent, Set<() => void>>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(duration: number) {
    this.duration = duration;
  }
  private emit(ev: ClockEvent) {
    this.listeners.get(ev)?.forEach((cb) => cb());
  }
  /** Advance the playhead to now. */
  private advance() {
    if (!this.playing) return;
    const now = performance.now();
    this.t += ((now - this.last) / 1000) * this.rate;
    this.last = now;
    if (this.t >= this.duration) {
      this.t = this.duration;
      this.playing = false;
      this.stopTimer();
      this.emit('pause');
      this.emit('ended');
    }
  }
  get time() {
    this.advance();
    return this.t;
  }
  get paused() {
    this.advance();
    return !this.playing;
  }
  async play() {
    if (this.playing) return;
    if (this.t >= this.duration - 0.01) {
      this.t = 0;
      this.emit('seeking');
      this.emit('seeked');
    }
    this.playing = true;
    this.last = performance.now();
    this.timer = setInterval(() => {
      this.advance();
      this.emit('timeupdate');
    }, 250);
    this.emit('play');
  }
  pause() {
    if (!this.playing) return;
    this.advance();
    this.playing = false;
    this.stopTimer();
    this.emit('pause');
  }
  seek(t: number) {
    this.advance();
    this.t = Math.min(Math.max(0, t), this.duration);
    this.last = performance.now();
    this.emit('seeking');
    this.emit('seeked');
    this.emit('timeupdate');
  }
  setRate(r: number) {
    this.advance();
    this.rate = r;
  }
  on(ev: ClockEvent, cb: () => void) {
    if (!this.listeners.has(ev)) this.listeners.set(ev, new Set());
    this.listeners.get(ev)!.add(cb);
    return () => {
      this.listeners.get(ev)?.delete(cb);
    };
  }
  private stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  dispose() {
    this.stopTimer();
    this.listeners.clear();
  }
}
