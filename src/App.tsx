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
import { PORTRAIT_PHONE_QUERY, useMediaMatch } from './ui/layout';
import { MoonDiscPanel } from './ui/MoonDiscPanel';
import { TimeReadout } from './ui/TimeReadout';
import { Transport } from './ui/Transport';
import { useHudSnapshot } from './ui/useHudSnapshot';
import { usePersistentFlag } from './ui/usePersistentFlag';

/** lucide-react has no brand icons; this is the Material Design Icons GitHub mark, as clipbox uses. */
function GitHubIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12,2A10,10 0 0,0 2,12C2,16.42 4.87,20.17 8.84,21.5C9.34,21.58 9.5,21.27 9.5,21C9.5,20.77 9.5,20.14 9.5,19.31C6.73,19.91 6.14,17.97 6.14,17.97C5.68,16.81 5.03,16.5 5.03,16.5C4.12,15.88 5.1,15.9 5.1,15.9C6.1,15.97 6.63,16.93 6.63,16.93C7.5,18.45 8.97,18 9.54,17.76C9.63,17.11 9.89,16.67 10.17,16.42C7.95,16.17 5.62,15.31 5.62,11.5C5.62,10.39 6,9.5 6.65,8.79C6.55,8.54 6.2,7.5 6.75,6.15C6.75,6.15 7.59,5.88 9.5,7.17C10.29,6.95 11.15,6.84 12,6.84C12.85,6.84 13.71,6.95 14.5,7.17C16.41,5.88 17.25,6.15 17.25,6.15C17.8,7.5 17.45,8.54 17.35,8.79C18,9.5 18.38,10.39 18.38,11.5C18.38,15.32 16.04,16.16 13.81,16.41C14.17,16.72 14.5,17.33 14.5,18.26C14.5,19.6 14.5,20.68 14.5,21C14.5,21.27 14.66,21.59 15.17,21.5C19.14,20.16 22,16.42 22,12A10,10 0 0,0 12,2Z" />
    </svg>
  );
}

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
  const discInRow = useMediaMatch(PORTRAIT_PHONE_QUERY);
  // Only honoured on phones, where the time controls carry the toggle; see index.css.
  const [settingsHidden, setSettingsHidden] = usePersistentFlag(
    'moon-sim:panel:settings-hidden',
    false,
  );

  return (
    <div className="app" ref={app} data-settings-hidden={settingsHidden || undefined}>
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
          {!discInRow && <MoonDiscPanel snap={snap} />}
        </div>
        {discInRow && <MoonDiscPanel snap={snap} row />}
        <TimeReadout />
        <Transport
          settingsHidden={settingsHidden}
          onToggleSettings={() => {
            setSettingsHidden(!settingsHidden);
          }}
        />
      </main>
      <aside id="settings" className="sidebar">
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
            <GitHubIcon size={12} />
            Source
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
