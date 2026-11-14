import { useEffect, useRef, useState } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router';
import { LiveRegion } from './components/LiveRegion';
import { SettingsDrawer } from './components/SettingsDrawer';
import { ShortcutHelp } from './components/ShortcutHelp';
import { SkipLink } from './components/SkipLink';
import { isTypingTarget } from './a11y/shortcuts';
import { Credits } from './pages/Credits';
import { Jukebox } from './pages/Jukebox';
import { Method } from './pages/Method';
import { Studio } from './pages/Studio';
import { prefersReducedMotion, useSettingsStore } from './state/useSettingsStore';

const NAV = [
  { to: '/', label: 'Jukebox', end: true },
  { to: '/method', label: 'Method', end: false },
  { to: '/credits', label: 'Credits', end: false },
];

function Header({ onSettings, onHelp }: { onSettings: () => void; onHelp: () => void }) {
  return (
    <header className="border-b border-border bg-bg">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <NavLink to="/" className="flex items-center gap-2 text-text no-underline" aria-label="TerraVoxis, home">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={28} height={28} />
          <span className="font-display text-lg font-bold tracking-tight">TerraVoxis</span>
        </NavLink>
        <nav aria-label="Main" className="flex-1">
          <ul className="flex flex-wrap gap-1">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    `inline-flex min-h-10 items-center rounded px-3 no-underline ${isActive ? 'bg-raised text-text underline decoration-sound decoration-2' : 'text-muted hover:text-text'}`
                  }
                >
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex gap-2">
          <button type="button" onClick={onHelp} className="min-h-10 rounded border border-edge px-3 text-sm hover:bg-raised" aria-haspopup="dialog">
            Shortcuts <span aria-hidden="true">(?)</span>
          </button>
          <button type="button" onClick={onSettings} className="min-h-10 rounded border border-edge px-3 text-sm hover:bg-raised" aria-haspopup="dialog">
            Settings
          </button>
        </div>
      </div>
    </header>
  );
}

/** Applies high contrast and reduced motion to the document. */
function useDocumentSettings() {
  const highContrast = useSettingsStore((s) => s.highContrast);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  useEffect(() => {
    document.documentElement.classList.toggle('hc', highContrast);
  }, [highContrast]);
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', prefersReducedMotion(reducedMotion));
  }, [reducedMotion]);
}

function FocusOnRouteChange() {
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // Move focus to the main heading so screen readers announce the new page.
    const h1 = document.querySelector('main h1') as HTMLElement | null;
    h1?.focus();
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Shell() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const shortcutsOn = useSettingsStore((s) => s.shortcuts);
  useDocumentSettings();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!shortcutsOn || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === '?') {
        e.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcutsOn]);

  return (
    <>
      <SkipLink />
      <Header onSettings={() => setSettingsOpen(true)} onHelp={() => setHelpOpen(true)} />
      <FocusOnRouteChange />
      <Routes>
        <Route path="/" element={<Jukebox />} />
        <Route path="/scene/:id" element={<Studio />} />
        <Route path="/method" element={<Method />} />
        <Route path="/credits" element={<Credits />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <footer className="mx-auto max-w-7xl px-4 pt-10 pb-28 text-sm text-muted lg:pb-10">
        <p>
          NASA content is used for educational purposes. TerraVoxis is not affiliated with or endorsed by NASA. Values are
          estimated from pixel colour and are not measurements.
        </p>
      </footer>
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <LiveRegion />
    </>
  );
}

function NotFound() {
  useEffect(() => {
    document.title = 'Page not found — TerraVoxis';
  }, []);
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10">
      <h1 tabIndex={-1} className="text-3xl font-bold">
        Page not found
      </h1>
      <p className="mt-4">
        <NavLink to="/">Go to the Jukebox</NavLink>
      </p>
    </main>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
