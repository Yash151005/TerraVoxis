import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { alertError, announce } from '../a11y/announce';
import { describe, trendOf, type Trend } from '../a11y/describe';
import { isTypingTarget } from '../a11y/shortcuts';
import { cancelSpeech, speak } from '../a11y/speech';
import { ExportDialog } from '../components/ExportDialog';
import { LegendStrip } from '../components/LegendStrip';
import { ModePicker } from '../components/ModePicker';
import { Readout } from '../components/Readout';
import { Stage, type StageHandle } from '../components/Stage';
import { StreamToggles } from '../components/StreamToggles';
import { Transport } from '../components/Transport';
import { audioEngine, type EngineStatus } from '../engine/audio/engine';
import { playLegend } from '../engine/audio/legend';
import { MAX_PROBE_VOICES } from '../engine/mapping/constants';
import type { ModeName } from '../engine/mapping/modes';
import { SCAN_DEFAULT_SECONDS } from '../engine/analysis/scan';
import { loadLut } from '../scenes/loadManifest';
import type { Lut, Scene } from '../scenes/types';
import { useManifest, usePageTitle } from '../scenes/useManifest';
import { ScanClock, VideoClock, type MediaClock } from '../state/clock';
import { useSettingsStore } from '../state/useSettingsStore';
import { modeConfigFromStore, useSonification } from '../state/useSonification';
import { useStudioStore } from '../state/useStudioStore';
import { ManifestError } from './Jukebox';

export function Studio() {
  const { id } = useParams();
  const { manifest, error, retry } = useManifest();
  const scene = manifest?.scenes.find((s) => s.id === id);
  usePageTitle(scene ? scene.title : manifest ? 'Scene not found' : 'Loading scene');
  if (error)
    return (
      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        <h1 tabIndex={-1} className="mb-4 text-3xl font-bold">
          Studio
        </h1>
        <ManifestError message={error} retry={retry} />
      </main>
    );
  if (!manifest)
    return (
      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        <h1 tabIndex={-1} className="text-3xl font-bold">
          Loading scene…
        </h1>
      </main>
    );
  if (!scene)
    return (
      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        <h1 tabIndex={-1} className="text-3xl font-bold">
          Scene not found
        </h1>
        <p className="mt-4">
          There is no scene called “{id}”. <Link to="/">Choose one in the Jukebox.</Link>
        </p>
      </main>
    );
  return <StudioScene key={scene.id} scene={scene} />;
}

function StudioScene({ scene }: { scene: Scene }) {
  const settings = useSettingsStore();
  const store = useStudioStore();
  const [lut, setLut] = useState<Lut | null | undefined>(scene.lut ? undefined : null);
  const [media, setMedia] = useState<HTMLVideoElement | HTMLImageElement | null>(null);
  const [mediaKey, setMediaKey] = useState(0);
  const [audioStatus, setAudioStatus] = useState<EngineStatus>(audioEngine.status);
  const [exportOpen, setExportOpen] = useState(false);
  const [description, setDescription] = useState('');
  const stageRef = useRef<StageHandle>(null);
  const legendAbort = useRef<AbortController | null>(null);

  // Fresh studio state for this scene.
  useEffect(() => {
    const s = useSettingsStore.getState();
    useStudioStore.getState().reset(scene.id, scene.defaultProbes, s.defaultMode, s.polarity);
  }, [scene]);

  // Lookup table.
  useEffect(() => {
    if (!scene.lut) return;
    let live = true;
    loadLut(scene.lut)
      .then((l) => live && setLut(l))
      .catch((e: Error) => {
        if (!live) return;
        setLut(null);
        useStudioStore.setState({ lutError: e.message });
        alertError(`${e.message} The scene will play without values.`);
      });
    return () => {
      live = false;
    };
  }, [scene]);

  const clock = useMemo<MediaClock | null>(() => {
    if (!media) return null;
    return media instanceof HTMLVideoElement ? new VideoClock(media) : new ScanClock(scene.scan?.duration ?? SCAN_DEFAULT_SECONDS);
  }, [media, scene]);
  useEffect(() => () => (clock instanceof ScanClock ? clock.dispose() : undefined), [clock]);

  const sonic = useSonification(scene, lut, media, clock);

  useEffect(() => audioEngine.onStatus(setAudioStatus) as unknown as () => void, []);
  useEffect(() => audioEngine.setVolume(settings.volume), [settings.volume]);
  useEffect(() => audioEngine.setMuted(store.muted), [store.muted]);
  useEffect(
    () => () => {
      legendAbort.current?.abort();
      cancelSpeech();
    },
    [],
  );

  const classLabels = useMemo(() => {
    const out: Record<string, string> = {};
    if (lut?.kind === 'categorical') lut.classes.forEach((c) => (out[c.id] = c.label));
    return out;
  }, [lut]);

  const onMediaReady = useCallback(
    (el: HTMLVideoElement | HTMLImageElement) => {
      setMedia(el);
      const duration = el instanceof HTMLVideoElement ? el.duration : (scene.scan?.duration ?? SCAN_DEFAULT_SECONDS);
      useStudioStore.setState({ mediaState: 'ready', duration, time: 0 });
    },
    [scene],
  );
  const onMediaError = useCallback(() => {
    useStudioStore.setState({ mediaState: 'error' });
    alertError('The NASA media for this scene could not be loaded.');
  }, []);

  const playPause = useCallback(async () => {
    if (!clock) return;
    await audioEngine.unlock();
    if (clock.paused) {
      legendAbort.current?.abort();
      await clock.play().catch(() => alertError('Playback could not start.'));
    } else clock.pause();
  }, [clock]);

  const toggleLegend = useCallback(async () => {
    if (legendAbort.current) {
      legendAbort.current.abort();
      return;
    }
    await audioEngine.unlock();
    clock?.pause();
    const ac = new AbortController();
    legendAbort.current = ac;
    useStudioStore.setState({ legendPlaying: true });
    const speechOn = useSettingsStore.getState().speech;
    try {
      await playLegend(scene, modeConfigFromStore(), audioEngine, {
        announce: (t) => announce(t, { requested: true }),
        speak: (t) => speak(t, ac.signal),
        signal: ac.signal,
        speechOn,
        classLabels,
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') announce('Legend stopped.', { requested: true });
      else throw e;
    } finally {
      cancelSpeech();
      legendAbort.current = null;
      useStudioStore.setState({ legendPlaying: false });
    }
  }, [scene, clock, classLabels]);

  const trends = useCallback((): Trend[] => {
    const h = sonic.history.current;
    if (!h.length) return [];
    const now = h[h.length - 1];
    const then = h.find((e) => now.at - e.at <= 2200) ?? h[0];
    return now.u.map((u, i) => (now.at - then.at > 1000 ? trendOf(u, then.u[i] ?? null) : null));
  }, [sonic.history]);

  const describeNow = useCallback(() => {
    sonic.refresh();
    const f = sonic.latest.current;
    if (!f) {
      announce('No frame has been read yet.', { requested: true });
      return;
    }
    const text = describe(f, scene, { trends: trends(), recentEvents: sonic.recentEvents.current.map((r) => r.e), classLabels });
    setDescription(text);
    announce(text, { requested: true });
    if (useSettingsStore.getState().speech) void speak(text);
  }, [sonic, scene, classLabels, trends]);

  const seek = useCallback(
    (t: number) => {
      clock?.seek(t);
      useStudioStore.setState({ time: t });
    },
    [clock],
  );
  const setRate = useCallback(
    (r: number) => {
      clock?.setRate(r);
      useStudioStore.setState({ rate: r });
    },
    [clock],
  );
  const toggleMute = useCallback(() => {
    const m = !useStudioStore.getState().muted;
    useStudioStore.setState({ muted: m });
    announce(m ? 'Muted.' : 'Sound on.', { requested: true });
  }, []);
  const chooseMode = useCallback((m: ModeName) => {
    useStudioStore.getState().setMode(m);
    announce(`${m[0].toUpperCase()}${m.slice(1)} mode.`, { requested: true });
  }, []);

  // Studio keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && legendAbort.current) {
        legendAbort.current.abort();
        return;
      }
      if (!useSettingsStore.getState().shortcuts || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      if (document.querySelector('dialog[open]')) return;
      const target = e.target as HTMLElement;
      const onControl = target.closest('button, a, input, select, summary, [role="radio"]');
      const k = e.key.toLowerCase();
      if ((e.key === ' ' && !onControl) || k === 'k') {
        e.preventDefault();
        void playPause();
      } else if (k === 'l') {
        e.preventDefault();
        void toggleLegend();
      } else if (k === 'd') {
        e.preventDefault();
        describeNow();
      } else if (k === 'm') {
        e.preventDefault();
        toggleMute();
      } else if (k === '1' || k === '2' || k === '3') {
        e.preventDefault();
        chooseMode((['scientific', 'musical', 'accessibility'] as const)[Number(k) - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playPause, toggleLegend, describeNow, toggleMute, chooseMode]);

  const addProbe = () => {
    const ps = useStudioStore.getState().probes;
    if (ps.length >= MAX_PROBE_VOICES) return;
    const p0 = ps[0] ?? scene.defaultProbes[0];
    useStudioStore.setState({ probes: [...ps, { x: Math.min(0.95, p0.x + 0.15), y: p0.y, r: p0.r }] });
    announce('Probe 2 added to the right of probe 1. It has its own voice, a buzzier tone.', { requested: true });
  };
  const removeProbe = () => {
    const ps = useStudioStore.getState().probes;
    if (ps.length <= 1) return;
    useStudioStore.setState({ probes: ps.slice(0, -1) });
    announce('Probe 2 removed.', { requested: true });
  };

  const recentEventCount = sonic.recentEvents.current.length;
  const q = scene.quantity;
  const isScan = scene.media.kind === 'image';
  const blocked = audioStatus === 'suspended' || audioStatus === 'interrupted';

  return (
    <main id="main" className="mx-auto max-w-7xl px-4 py-6 pb-40 lg:pb-6">
      <div className="mb-4">
        <p className="font-mono text-sm text-sound">
          <Link to="/">Jukebox</Link> <span aria-hidden="true">/</span> SVS {scene.svsId}
        </p>
        <h1 tabIndex={-1} className="mt-1 text-3xl font-bold sm:text-4xl">
          {scene.title}
        </h1>
        <p className="mt-1 text-lg text-data">{scene.tagline}</p>
      </div>
      {blocked && (
        <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-sound p-3">
          <span>The browser has paused sound for this page.</span>
          <button type="button" className="min-h-11 rounded bg-sound px-4 font-semibold text-bg" onClick={() => void audioEngine.unlock()}>
            Enable sound
          </button>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <section aria-labelledby="stage-h">
          <h2 id="stage-h" className="sr-only">
            Picture and probes
          </h2>
          <p id="probe-help" className="sr-only">
            Use the arrow keys to move the probe by 1 percent, or Shift and the arrow keys to move by 5 percent. The reading is announced when you let go.
          </p>
          <p className="sr-only">{scene.description}</p>
          {store.mediaState === 'error' ? (
            <div role="alert" className="rounded-md border border-danger p-5">
              <h3 className="text-xl font-semibold">The NASA media could not be loaded</h3>
              <p className="mt-2">The file may be missing, or the connection dropped. You can try again, or see the original on NASA’s site.</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="min-h-11 rounded bg-sound px-4 font-semibold text-bg"
                  onClick={() => {
                    useStudioStore.setState({ mediaState: 'loading' });
                    setMedia(null);
                    setMediaKey((k) => k + 1);
                  }}
                >
                  Try again
                </button>
                <a className="inline-flex min-h-11 items-center" href={scene.svsUrl} target="_blank" rel="noopener noreferrer">
                  Open SVS {scene.svsId} (opens in a new tab)
                </a>
              </div>
            </div>
          ) : (
            <Stage
              ref={stageRef}
              scene={scene}
              classLabels={classLabels}
              mediaKey={mediaKey}
              onMediaReady={onMediaReady}
              onMediaError={onMediaError}
              onProbeMoved={() => {
                sonic.refresh();
                return sonic.latest.current?.probes;
              }}
            />
          )}
          <LegendStrip scene={scene} lut={lut} readout={store.readout} />
          {store.lutError && <p className="mt-2 text-danger">{store.lutError} No values can be estimated, but the picture still plays.</p>}
          <Transport
            onLegend={() => void toggleLegend()}
            onPlayPause={() => void playPause()}
            onSeek={seek}
            onRate={setRate}
            onMute={toggleMute}
            disabled={store.mediaState !== 'ready'}
            isScan={isScan}
          />
          <p className="mt-3 text-sm text-muted">
            Visualization by NASA’s Scientific Visualization Studio: {scene.credits.join(', ')}.{' '}
            <a href={scene.svsUrl} target="_blank" rel="noopener noreferrer">
              SVS {scene.svsId} (opens in a new tab)
            </a>
            . NASA content is used for educational purposes. TerraVoxis is not affiliated with or endorsed by NASA.
          </p>
        </section>

        <aside aria-label="Controls and readout" className="flex flex-col gap-4">
          <ModePicker />
          <Readout readout={store.readout} scene={scene} classLabels={classLabels} recentEventCount={recentEventCount} />
          <div>
            <button type="button" onClick={describeNow} className="min-h-11 w-full rounded border border-data px-4 font-semibold text-data hover:bg-raised" aria-keyshortcuts="D">
              Describe this moment
            </button>
            {description && (
              <p className="mt-2 rounded-md border border-border bg-surface p-3 text-sm" data-testid="description">
                {description}
              </p>
            )}
          </div>
          <StreamToggles scene={scene} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={addProbe} disabled={store.probes.length >= MAX_PROBE_VOICES} className="min-h-11 flex-1 rounded border border-edge px-3 hover:bg-raised disabled:opacity-50">
              Add probe
            </button>
            <button type="button" onClick={removeProbe} disabled={store.probes.length <= 1} className="min-h-11 flex-1 rounded border border-edge px-3 hover:bg-raised disabled:opacity-50">
              Remove probe
            </button>
          </div>
          {q.kind === 'continuous' && (
            <fieldset className="rounded-md border border-border p-3">
              <legend className="px-1 font-semibold">Pitch direction</legend>
              <label className="flex min-h-10 items-center gap-3">
                <input type="radio" name="polarity" className="h-5 w-5 accent-sound" checked={store.polarity === 1} onChange={() => store.set({ polarity: 1 })} />
                Higher pitch means more
              </label>
              <label className="flex min-h-10 items-center gap-3">
                <input type="radio" name="polarity" className="h-5 w-5 accent-sound" checked={store.polarity === -1} onChange={() => store.set({ polarity: -1 })} />
                Higher pitch means less
              </label>
            </fieldset>
          )}
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            disabled={store.mediaState !== 'ready' || !sonic.ctx}
            className="min-h-11 rounded border border-edge px-4 hover:bg-raised disabled:opacity-50"
            aria-haspopup="dialog"
          >
            Export sound (WAV and mapping file)
          </button>
          <details className="rounded-md border border-border p-3">
            <summary className="min-h-10 cursor-pointer py-2 font-semibold">About this scene</summary>
            <h3 className="mt-2 font-semibold">Story</h3>
            <p>{scene.story}</p>
            <h3 className="mt-3 font-semibold">Full description</h3>
            <p>{scene.description}</p>
            <h3 className="mt-3 font-semibold">How values are read</h3>
            <p>{scene.provenance}</p>
            <h3 className="mt-3 font-semibold">Credits</h3>
            <p>
              Visualization by NASA’s Scientific Visualization Studio. {scene.credits.join(', ')}.{' '}
              <a href={scene.svsUrl} target="_blank" rel="noopener noreferrer">
                {scene.svsUrl} (opens in a new tab)
              </a>
            </p>
          </details>
        </aside>
      </div>
      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        scene={scene}
        ctx={sonic.ctx}
        getMedia={() => media}
        onBeforeExport={() => clock?.pause()}
        onAfterExport={() => sonic.refresh()}
      />
    </main>
  );
}
