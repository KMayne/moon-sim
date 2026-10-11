import { useFrame } from '@react-three/fiber';
import { computeSystemState } from '../astro/ephemeris';
import { toOrbitScene } from '../sim/orbitScene';
import { useSimStore } from '../state/store';
import { PRIORITY, useFrameRef } from './frame';

/** Samples the clock exactly once per frame and derives all scene state from that instant. */
export function FrameDriver() {
  const frameRef = useFrameRef();
  const clock = useSimStore((s) => s.clock);

  useFrame(() => {
    const simMs = clock.nowMs();
    const state = computeSystemState(new Date(simMs));
    frameRef.current = { simMs, orbit: toOrbitScene(state) };
  }, PRIORITY.driver);

  return null;
}
