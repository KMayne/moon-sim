import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { Vec3 } from '../../astro/vec';
import { sampleDailyArcs } from '../../sim/skyArcs';
import { useSimStore } from '../../state/store';
import type { ObserverLocation } from '../../state/locations';
import { PRIORITY, useFrameRef } from '../frame';
import { SKY_RENDER_ORDER } from './renderOrder';

/** Beyond the Moon (so it hides the arc behind it), inside the ground (which hides the rest). */
const ARC_RADIUS = 20_000;
/** Resample once sim time has moved this far… */
const RESAMPLE_SIM_MS = 20 * 60_000;
/** …but never more often than this in wall time. */
const RESAMPLE_MIN_WALL_MS = 250;

type Points = [number, number, number][];
type Colors = [number, number, number, number][];

const toPoints = (dirs: readonly Vec3[]): Points =>
  dirs.map((d) => [d.x * ARC_RADIUS, d.y * ARC_RADIUS, d.z * ARC_RADIUS]);

const ARC_OPACITY = 0.55;
const SUN_RGB = [1, 0.81, 0.4] as const;
const MOON_RGB = [0.79, 0.83, 1] as const;

/**
 * Below-horizon samples are fully transparent. The ground would hide them too, but at grazing
 * angles 20 km away its depth test z-fights into a streak along the horizon.
 */
const toColors = (dirs: readonly Vec3[], rgb: readonly [number, number, number]): Colors =>
  dirs.map((d) => [...rgb, d.y >= 0 ? ARC_OPACITY : 0]);

interface Arc {
  points: Points;
  colors: Colors;
}

/**
 * Today's paths of the Sun and Moon across this observer's sky (±12 h). Over weeks they show the
 * Moon's arc climbing and sinking and its rising point swinging along the horizon.
 */
export function DailyArcs() {
  const frameRef = useFrameRef();
  const last = useRef<{ simMs: number; wallMs: number; location: ObserverLocation | null }>({
    simMs: Number.NaN,
    wallMs: -Infinity,
    location: null,
  });
  const [arcs, setArcs] = useState<{ sun: Arc; moon: Arc } | null>(null);

  useFrame(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const location = useSimStore.getState().location;
    const wallMs = performance.now();
    const prev = last.current;
    const stale =
      location !== prev.location || !(Math.abs(frame.simMs - prev.simMs) < RESAMPLE_SIM_MS);
    if (stale && wallMs - prev.wallMs >= RESAMPLE_MIN_WALL_MS) {
      last.current = { simMs: frame.simMs, wallMs, location };
      const sampled = sampleDailyArcs(frame.simMs, location);
      setArcs({
        sun: { points: toPoints(sampled.sun), colors: toColors(sampled.sun, SUN_RGB) },
        moon: { points: toPoints(sampled.moon), colors: toColors(sampled.moon, MOON_RGB) },
      });
    }
  }, PRIORITY.update);

  if (!arcs) return null;
  return (
    <>
      {[arcs.sun, arcs.moon].map((arc, i) => (
        <Line
          key={i}
          points={arc.points}
          vertexColors={arc.colors}
          lineWidth={1.5}
          transparent
          renderOrder={SKY_RENDER_ORDER.overlay}
        />
      ))}
    </>
  );
}
