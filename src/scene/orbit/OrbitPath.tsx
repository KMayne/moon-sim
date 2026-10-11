import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { Group } from 'three';
import type { Vec3 } from '../../astro/vec';
import { ORBIT_PATH_SAMPLES, sampleMoonOrbitEqj } from '../../sim/orbitPath';
import { KM_TO_SCENE } from '../../sim/orbitScene';
import { applyRotation } from '../applyTransform';
import { PRIORITY, useFrameRef } from '../frame';

/** Resample once sim time has moved this far: the orbit's shape changes slowly. */
const RESAMPLE_SIM_MS = 2 * 3_600_000;
/** …but never more often than this in wall time, however fast the sim runs. */
const RESAMPLE_MIN_WALL_MS = 250;

type Points = [number, number, number][];

const PATH_RGB = [0x8a / 255, 0x93 / 255, 0xb8 / 255] as const;
const PATH_OPACITY = 0.6;
/** Fraction of each half (measured from the Moon) drawn at full opacity before fading out. */
const SOLID_FRACTION = 0.7;

/**
 * The Moon's real track over one sidereal month does not close: solar perturbations and the
 * precessing orbit leave the ends 0.2–1.9 Earth radii apart. Rather than draw that as a kink
 * opposite the Moon, both ends fade to nothing.
 */
const FADE_COLORS: [number, number, number, number][] = (() => {
  const half = Math.floor(ORBIT_PATH_SAMPLES / 2);
  return Array.from({ length: 2 * half + 1 }, (_, i) => {
    const s = Math.abs(i - half) / half;
    const t = Math.min(1, Math.max(0, (s - SOLID_FRACTION) / (1 - SOLID_FRACTION)));
    const fade = 1 - t * t * (3 - 2 * t);
    return [...PATH_RGB, PATH_OPACITY * fade];
  });
})();

const toPoints = (path: readonly Vec3[]): Points => path.map((p) => [p.x, p.y, p.z]);

/**
 * The Moon's orbit over ±½ sidereal month, fading out at the ends. Samples are inertial (EQJ, km)
 * and expensive, so they are refreshed only occasionally; the cheap EQJ→scene rotation and the
 * distance visual aid are applied every frame so the path stays aligned with the Moon.
 */
export function OrbitPath() {
  const frameRef = useFrameRef();
  const group = useRef<Group>(null);
  const lastSample = useRef({ simMs: Number.NaN, wallMs: -Infinity });
  const [points, setPoints] = useState<Points | null>(null);

  useFrame(() => {
    const frame = frameRef.current;
    if (!frame) return;
    if (group.current) {
      applyRotation(group.current, frame.orbit.eqjToScene);
      // Same distance visual aid as the Moon, so the Moon stays on its path.
      group.current.scale.setScalar(KM_TO_SCENE * frame.orbit.visualScale.moonDistance);
    }

    const wallMs = performance.now();
    const last = lastSample.current;
    const stale = !(Math.abs(frame.simMs - last.simMs) < RESAMPLE_SIM_MS);
    if (stale && wallMs - last.wallMs >= RESAMPLE_MIN_WALL_MS) {
      lastSample.current = { simMs: frame.simMs, wallMs };
      setPoints(toPoints(sampleMoonOrbitEqj(frame.simMs)));
    }
  }, PRIORITY.update);

  return (
    <group ref={group}>
      {points && <Line points={points} vertexColors={FADE_COLORS} lineWidth={1} transparent />}
    </group>
  );
}
