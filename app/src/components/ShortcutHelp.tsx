import { SHORTCUTS } from '../a11y/shortcuts';
import { useSettingsStore } from '../state/useSettingsStore';
import { Dialog } from './Dialog';

export function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const on = useSettingsStore((s) => s.shortcuts);
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts">
      {!on && <p className="mb-3 text-sound">Single-key shortcuts are turned off in Settings.</p>}
      <table className="w-full text-left">
        <caption className="sr-only">Keys and what they do</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="py-2 pr-4">
              Key
            </th>
            <th scope="col" className="py-2">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {SHORTCUTS.map((s) => (
            <tr key={s.keys} className="border-b border-border/60">
              <td className="py-2 pr-4 font-mono text-sm">{s.keys}</td>
              <td className="py-2">{s.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}
