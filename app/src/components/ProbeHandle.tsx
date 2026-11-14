import { useRef } from 'react';
import { announce } from '../a11y/announce';
import { describeProbe, probeAriaLabel } from '../a11y/describe';
import type { ProbeFeatures } from '../engine/types';
import type { ProbeSpec, Scene } from '../scenes/types';
import { useStudioStore } from '../state/useStudioStore';

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

type Props = {
  index: number;
  spec: ProbeSpec;
  features: ProbeFeatures | undefined;
  scene: Scene;
  stageRef: React.RefObject<HTMLDivElement | null>;
  classLabels: Record<string, string>;
  /** Called after a move so the readout can refresh before announcing. */
  onMoved: () => ProbeFeatures | undefined;
};

export function ProbeHandle({ index, spec, features, scene, stageRef, classLabels, onMoved }: Props) {
  const moveProbe = useStudioStore((s) => s.moveProbe);
  const dragging = useRef(false);
  const moved = useRef(false);

  const announceNow = () => {
    const f = onMoved();
    if (f) announce(describeProbe(f, index, scene, { classLabels }), { requested: true });
  };

  const fromPointer = (e: React.PointerEvent) => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return;
    moveProbe(index, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  };

  const size = `max(24px, ${spec.r * 2 * 100}%)`;
  return (
    <button
      type="button"
      className="probe-handle"
      style={{ left: `${spec.x * 100}%`, top: `${spec.y * 100}%`, width: size, aspectRatio: '1 / 1' }}
      aria-roledescription="listening probe"
      aria-label={probeAriaLabel(features, spec, index, scene)}
      aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Shift+ArrowUp Shift+ArrowDown Shift+ArrowLeft Shift+ArrowRight"
      aria-describedby="probe-help"
      data-probe={index + 1}
      onKeyDown={(e) => {
        const d = ARROWS[e.key];
        if (!d) return;
        e.preventDefault();
        e.stopPropagation();
        const step = e.shiftKey ? 0.05 : 0.01;
        moveProbe(index, spec.x + d[0] * step, spec.y + d[1] * step);
        moved.current = true;
      }}
      onKeyUp={(e) => {
        if (ARROWS[e.key] && moved.current) {
          moved.current = false;
          announceNow();
        }
      }}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        e.preventDefault();
        (e.currentTarget as HTMLElement).focus();
      }}
      onPointerMove={(e) => {
        if (dragging.current) fromPointer(e);
      }}
      onPointerUp={(e) => {
        if (!dragging.current) return;
        dragging.current = false;
        fromPointer(e);
        announceNow();
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    >
      <span className="probe-num" aria-hidden="true">
        {index + 1}
      </span>
    </button>
  );
}
