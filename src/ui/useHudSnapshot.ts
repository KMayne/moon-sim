import { useEffect, useState } from 'react';
import { ECLIPSES_ENABLED } from '../features';
import type { ObserverLocation } from '../state/locations';
import { useSimStore } from '../state/store';
import { createHudCaches, hudSnapshot, type HudCaches, type HudSnapshot } from './hudModel';

const HUD_INTERVAL_MS = 250;

/** The HUD snapshot, never announcing an eclipse while they're hidden (features.ts). */
function snapshot(simMs: number, location: ObserverLocation, caches: HudCaches): HudSnapshot {
  const snap = hudSnapshot(simMs, location, caches);
  return ECLIPSES_ENABLED ? snap : { ...snap, eclipses: { ...snap.eclipses, inProgress: null } };
}

/** Moon and observer readouts, polled at a few Hz; never updated per frame. */
export function useHudSnapshot(): HudSnapshot {
  const clock = useSimStore((s) => s.clock);
  const location = useSimStore((s) => s.location);
  const [caches] = useState(createHudCaches);
  const [snap, setSnap] = useState<HudSnapshot>(() => snapshot(clock.nowMs(), location, caches));

  useEffect(() => {
    const id = setInterval(() => {
      setSnap(snapshot(clock.nowMs(), location, caches));
    }, HUD_INTERVAL_MS);
    return () => {
      clearInterval(id);
    };
  }, [clock, location, caches]);

  return snap;
}
