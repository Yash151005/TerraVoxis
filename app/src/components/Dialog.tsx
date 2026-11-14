import { useEffect, useId, useRef, type ReactNode } from 'react';

/** Native modal dialog: focus is trapped, Escape closes, focus returns to the opener. */
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-lg border border-edge bg-surface p-0 text-text backdrop:bg-black/70"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 id={titleId} className="text-xl font-semibold">
          {title}
        </h2>
        <button type="button" onClick={onClose} className="min-h-10 min-w-10 rounded border border-edge px-3 hover:bg-raised">
          Close
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
    </dialog>
  );
}
