import { Divider } from '@mantine/core';
import { ArrowUpRight } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { ECLIPSES_ENABLED } from './features';
import { OrbitView } from './scene/orbit/OrbitView';
import { SkyView } from './scene/sky/SkyView';
import { SimulationCanvas } from './scene/SimulationCanvas';
import { useSimStore } from './state/store';
import { useUrlSync } from './state/useUrlSync';
import { Controls } from './ui/Controls';
import { OrbitFocusToggle } from './ui/OrbitFocusToggle';
import { EclipsesSection } from './ui/controls/EclipsesSection';
import { Hud } from './ui/Hud';
import { MoonDiscPanel } from './ui/MoonDiscPanel';
import { TimeReadout } from './ui/TimeReadout';
import { Transport } from './ui/Transport';
import { useHudSnapshot } from './ui/useHudSnapshot';

/** Hidden tabs don't advance sim time, so returning to a tab never lands years later. */
function useFreezeWhenHidden() {
  const clock = useSimStore((s) => s.clock);
  useEffect(() => {
    const sync = () => {
      clock.setFrozen(document.hidden);
    };
    document.addEventListener('visibilitychange', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
    };
  }, [clock]);
}

export function App() {
  const app = useRef<HTMLDivElement>(null);
  useFreezeWhenHidden();
  useUrlSync();
  const snap = useHudSnapshot();

  return (
    <div className="app" ref={app}>
      {/* One canvas over the whole app: every view (orbit, sky, Moon disc) renders in it. */}
      <ErrorBoundary fallback={<p className="fallback">The 3D view failed to start.</p>}>
        <SimulationCanvas eventSource={app} />
      </ErrorBoundary>
      <main className="views">
        <div className="view-cell">
          <OrbitView className="view view--orbit" />
          <OrbitFocusToggle />
        </div>
        <div className="view-cell">
          <SkyView className="view view--sky" />
          <MoonDiscPanel snap={snap} />
        </div>
        <TimeReadout />
        <Transport />
      </main>
      <aside className="sidebar">
        <div className="sidebar__scroll">
          <Hud snap={snap} />
          {ECLIPSES_ENABLED && (
            <>
              <Divider />
              <EclipsesSection snap={snap} />
            </>
          )}
          <Divider />
          <Controls />
        </div>
        <footer className="sidebar__footer">
          <a
            className="sidebar__credit"
            href="https://github.com/KMayne/moon-sim"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
            <ArrowUpRight size={12} aria-hidden />
            <span className="visually-hidden"> (opens in a new tab)</span>
          </a>
          <span className="sidebar__sep" aria-hidden>
            &middot;
          </span>
          <a
            className="sidebar__credit"
            href="https://kianmayne.co.uk/"
            target="_blank"
            rel="noopener noreferrer"
          >
            KianMayne.co.uk
            <ArrowUpRight size={12} aria-hidden />
            <span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        </footer>
      </aside>
    </div>
  );
}
