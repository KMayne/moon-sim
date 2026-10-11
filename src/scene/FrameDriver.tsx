import { useFrame } from '@react-three/fiber';
import { computeSystemState } from '../astro/ephemeris';
import { ECLIPSES_ENABLED } from '../features';
import { toDiscScene } from '../sim/discScene';
import { eclipseGeometry, lunarEclipseState } from '../sim/eclipse';
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
    const sky = toSkyScene(
      state,
      location,
      { bodySize: visualScale.bodySize },
      { eclipses: ECLIPSES_ENABLED },
    );
    const orbit = toOrbitScene(state, visualScale);
    frameRef.current = {
      simMs,
      orbit,
      sky,
      disc: toDiscScene(state, sky),
      eclipse: {
        state: lunarEclipseState(state),
        orbit: eclipseGeometry(state, orbit.eqjToScene),
        sky: eclipseGeometry(state, sky.eqjToSky),
      },
    };
  }, PRIORITY.driver);

  return null;
}
