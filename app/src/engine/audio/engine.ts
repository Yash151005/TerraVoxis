import type { VoiceTargets } from '../types';
import { MASTER_CEILING } from '../mapping/constants';
import { applyTargets, buildGraph, silenceVoices, triggerEvent, type Graph } from './buildGraph';

export type EngineStatus = 'none' | 'running' | 'suspended' | 'interrupted' | 'closed';

type Listener = (s: EngineStatus) => void;

/** Live playback: owns the AudioContext. The video clock drives it through apply(). */
export class AudioEngine {
  ctx: AudioContext | null = null;
  graph: Graph | null = null;
  private classIds: string[] = [];
  private volume = 0.8;
  private muted = false;
  /** Sound passes only while media plays or the legend runs. */
  private gates = new Set<string>();
  private listeners = new Set<Listener>();

  get status(): EngineStatus {
    return (this.ctx?.state as EngineStatus | undefined) ?? 'none';
  }

  onStatus(cb: Listener) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit() {
    this.listeners.forEach((l) => l(this.status));
  }

  /** Must be called inside a user gesture handler. */
  async unlock(): Promise<boolean> {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.ctx.addEventListener('statechange', () => this.emit());
      this.rebuild();
    }
    if (this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch {
        /* reported through status */
      }
    }
    this.emit();
    return this.ctx.state === 'running';
  }

  setScene(classIds: string[]) {
    this.classIds = classIds;
    if (this.ctx) this.rebuild();
  }

  private rebuild() {
    if (!this.ctx) return;
    if (this.graph) {
      const old = this.graph;
      old.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
      setTimeout(() => old.limiter.disconnect(), 100);
    }
    this.graph = buildGraph(this.ctx, this.classIds, { analyser: true });
    this.graph.master.gain.value = 0;
    this.updateMaster(0.01);
  }

  private masterTarget() {
    return this.muted || this.gates.size === 0 ? 0 : MASTER_CEILING * this.volume;
  }

  private updateMaster(tc: number) {
    if (!this.ctx || !this.graph) return;
    // A 50 ms ramp is about three time constants.
    this.graph.master.gain.setTargetAtTime(this.masterTarget(), this.ctx.currentTime, tc);
  }

  /** Open or close a named gate ('media', 'legend'). Closing all gates ramps to silence in 50 ms. */
  setGate(name: string, open: boolean) {
    const had = this.gates.has(name);
    if (open === had) return;
    if (open) this.gates.add(name);
    else this.gates.delete(name);
    this.updateMaster(0.017);
  }

  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
    this.updateMaster(0.02);
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.updateMaster(0.01);
  }

  apply(targets: VoiceTargets) {
    if (!this.ctx || !this.graph || this.ctx.state !== 'running') return;
    applyTargets(this.graph, targets, this.ctx.currentTime + 0.02);
  }

  hit(h: { freq: number; gain: number; pan: number }, delay = 0.02) {
    if (!this.ctx || !this.graph) return;
    triggerEvent(this.graph, h, this.ctx.currentTime + delay);
  }

  /** Seek: silence in about 30 ms. */
  silence() {
    if (!this.ctx || !this.graph) return;
    silenceVoices(this.graph, this.ctx.currentTime, 0.01);
  }

  /** RMS of the master output, for tests and the level meter. */
  level(): number {
    const a = this.graph?.analyser;
    if (!a) return 0;
    const buf = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(buf);
    let s = 0;
    for (const v of buf) s += v * v;
    return Math.sqrt(s / buf.length);
  }
}

export const audioEngine = new AudioEngine();
