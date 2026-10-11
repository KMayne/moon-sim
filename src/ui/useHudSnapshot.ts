import { useEffect, useState } from 'react';
import { useSimStore } from '../state/store';
import { createHudCaches, hudSnapshot, type HudSnapshot } from './hudModel';

const HUD_INTERVAL_MS = 250;

/** Moon and observer readouts, polled at a few Hz; never updated per frame. */
export function useHudSnapshot(): HudSnapshot {
  const clock = useSimStore((s) => s.clock);
  const location = useSimStore((s) => s.location);
  const [caches] = useState(createHudCaches);
  const [snap, setSnap] = useState<HudSnapshot>(() => hudSnapshot(clock.nowMs(), location, caches));

  useEffect(() => {
    const id = setInterval(() => {
      setSnap(hudSnapshot(clock.nowMs(), location, caches));
    }, HUD_INTERVAL_MS);
    return () => {
      clearInterval(id);
    };
  }, [clock, location, caches]);

  return snap;
}
