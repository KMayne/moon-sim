import { useFrame } from '@react-three/fiber';
import { computeSystemState } from '../astro/ephemeris';
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
    frameRef.current = {
      simMs,
      orbit: toOrbitScene(state),
      sky: toSkyScene(state, location, { moonSize: visualScale.moonSize }),
    };
  }, PRIORITY.driver);

  return null;
}
