import { useEffect, useRef } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { OrbitView } from './scene/orbit/OrbitView';
import { SkyView } from './scene/sky/SkyView';
import { SimulationCanvas } from './scene/SimulationCanvas';
import { useSimStore } from './state/store';
import { useUrlSync } from './state/useUrlSync';
import { Controls } from './ui/Controls';
import { Hud } from './ui/Hud';
import { TimeReadout } from './ui/TimeReadout';

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
  const views = useRef<HTMLDivElement>(null);
  useFreezeWhenHidden();
  useUrlSync();

  return (
    <div className="app">
      <main className="views" ref={views}>
        <OrbitView className="view view--orbit" />
        <SkyView className="view view--sky" />
        <ErrorBoundary fallback={<p className="fallback">The 3D view failed to start.</p>}>
          <SimulationCanvas eventSource={views} />
        </ErrorBoundary>
        <TimeReadout />
      </main>
      <aside className="sidebar">
        <Controls />
        <Hud />
      </aside>
    </div>
  );
}
