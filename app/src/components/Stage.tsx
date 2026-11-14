import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { ProbeFeatures } from '../engine/types';
import { assetUrl } from '../scenes/loadManifest';
import type { Scene } from '../scenes/types';
import { prefersReducedMotion, useSettingsStore } from '../state/useSettingsStore';
import { useStudioStore } from '../state/useStudioStore';
import { ProbeHandle } from './ProbeHandle';

export type StageHandle = { media: HTMLVideoElement | HTMLImageElement | null };

type Props = {
  scene: Scene;
  classLabels: Record<string, string>;
  onMediaReady: (el: HTMLVideoElement | HTMLImageElement) => void;
  onMediaError: () => void;
  onProbeMoved: () => ProbeFeatures[] | undefined;
  mediaKey: number;
};

export const Stage = forwardRef<StageHandle, Props>(function Stage({ scene, classLabels, onMediaReady, onMediaError, onProbeMoved, mediaKey }, ref) {
  const stageRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLVideoElement | HTMLImageElement | null>(null);
  useImperativeHandle(ref, () => ({ media: mediaRef.current }));
  const probes = useStudioStore((s) => s.probes);
  const readout = useStudioStore((s) => s.readout);
  const mediaState = useStudioStore((s) => s.mediaState);
  const time = useStudioStore((s) => s.time);
  const duration = useStudioStore((s) => s.duration);
  const reduced = prefersReducedMotion(useSettingsStore((s) => s.reducedMotion));
  const isImage = scene.media.kind === 'image';
  let scanX = duration ? Math.min(1, time / duration) : 0;
  if (reduced) scanX = Math.round(scanX * 20) / 20;

  return (
    <div
      ref={stageRef}
      className="relative w-full overflow-visible rounded-md border border-border bg-black"
      style={{ aspectRatio: `${scene.media.width} / ${scene.media.height}` }}
    >
      {isImage ? (
        <img
          key={mediaKey}
          ref={(el) => {
            mediaRef.current = el;
          }}
          src={assetUrl(scene.media.src)}
          alt=""
          className="absolute inset-0 h-full w-full select-none"
          draggable={false}
          onLoad={(e) => onMediaReady(e.currentTarget)}
          onError={onMediaError}
        />
      ) : (
        <video
          key={mediaKey}
          ref={(el) => {
            mediaRef.current = el;
          }}
          className="absolute inset-0 h-full w-full"
          src={assetUrl(scene.media.src)}
          poster={assetUrl(scene.media.poster)}
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          onLoadedData={(e) => onMediaReady(e.currentTarget)}
          onError={onMediaError}
        />
      )}
      {mediaState === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg/60" role="status">
          <div className="flex items-center gap-3 rounded bg-surface px-4 py-3">
            <span className="inline-block h-4 w-4 rounded-full border-2 border-data border-t-transparent motion-safe:animate-spin" aria-hidden="true" />
            Loading NASA media
          </div>
        </div>
      )}
      {isImage && mediaState === 'ready' && <div className="scan-line" style={{ left: `${scanX * 100}%` }} aria-hidden="true" />}
      {mediaState === 'ready' &&
        probes.map((p, i) => (
          <ProbeHandle
            key={i}
            index={i}
            spec={p}
            features={readout?.probes[i]}
            scene={scene}
            stageRef={stageRef}
            classLabels={classLabels}
            onMoved={() => onProbeMoved()?.[i]}
          />
        ))}
    </div>
  );
});
