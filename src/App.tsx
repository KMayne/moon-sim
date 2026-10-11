import { useEffect, useRef } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { OrbitView } from './scene/orbit/OrbitView';
import { SkyView } from './scene/sky/SkyView';
import { SimulationCanvas } from './scene/SimulationCanvas';
import { useSimStore } from './state/store';
import { useUrlSync } from './state/useUrlSync';
import { Controls } from './ui/Controls';
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
        <OrbitView className="view view--orbit" />
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
          <Controls />
        </div>
      </aside>
    </div>
  );
}
