import { useFrame } from '@react-three/fiber';
import { computeSystemState } from '../astro/ephemeris';
import { toDiscScene } from '../sim/discScene';
import { toOrbitScene } from '../sim/orbitScene';
import { toSkyScene } from '../sim/skyScene';
import { useSimStore } from '../state/store';
import { PRIORITY, useFrameRef } from './frame';

/** Samples the clock exactly once per frame and derives all scene state from that instant. */
export function FrameDriver() {
  const frameRef = useFrameRef();
  const clock = useSimStore((s) => s.clock);

  useFrame(() => {
    const simMs = clock.nowMs();
    const state = computeSystemState(new Date(simMs));
    // Read settings imperatively: changing them must not re-render the canvas tree.
    const { location, visualScale } = useSimStore.getState();
    const sky = toSkyScene(state, location, { bodySize: visualScale.bodySize });
    frameRef.current = {
      simMs,
      orbit: toOrbitScene(state, visualScale),
      sky,
      disc: toDiscScene(state, sky),
    };
  }, PRIORITY.driver);

  return null;
}
