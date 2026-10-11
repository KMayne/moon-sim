import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { PerspectiveCamera, Vector3 } from 'three';
import { EARTH_RADIUS_KM } from '../../astro/constants';
import { vec } from '../../astro/vec';
import { fitOpeningShot } from '../../sim/openingShot';
import { PRIORITY } from '../frame';
import { SUN_DISTANCE } from './Sun';

/** Apogee never exceeds ~406,700 km; frame a little beyond it. */
const ORBIT_RADIUS = 410_000 / EARTH_RADIUS_KM;
/** Wait for the view's aspect to settle (e.g. during a window drag) before refitting. */
const REFIT_SETTLE_MS = 150;

/** The subset of OrbitControls this component uses. */
interface Controls {
  target: Vector3;
  update(): void;
  addEventListener(type: 'start', listener: () => void): void;
  removeEventListener(type: 'start', listener: () => void): void;
}

/**
 * Frames the opening shot for the current viewport shape and keeps doing so on resize — until the
 * user first moves the camera, after which it never touches the camera again.
 */
export function OpeningShot({ maxDistance }: { maxDistance: number }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const userHasMoved = useRef(false);
  const fitted = useRef({ aspect: Number.NaN, pendingSince: Number.NaN, frames: 0 });

  useEffect(() => {
    if (!controls) return;
    const onStart = () => {
      userHasMoved.current = true;
    };
    controls.addEventListener('start', onStart);
    return () => {
      controls.removeEventListener('start', onStart);
    };
  }, [controls]);

  useFrame(() => {
    if (userHasMoved.current || !controls) return;
    const state = fitted.current;
    // drei's View sets camera.aspect from its tracked element when it renders, which happens after
    // this callback — so the first frame's aspect is not yet the view's.
    if (state.frames++ < 1) return;
    const aspect = camera.aspect;
    if (Math.abs(aspect - state.aspect) < 1e-3) {
      state.pendingSince = Number.NaN;
      return;
    }
    const now = performance.now();
    const firstFit = Number.isNaN(state.aspect);
    if (!firstFit) {
      if (Number.isNaN(state.pendingSince)) state.pendingSince = now;
      if (now - state.pendingSince < REFIT_SETTLE_MS) return;
    }

    const shot = fitOpeningShot({
      aspect,
      fovDeg: camera.fov,
      orbitRadius: ORBIT_RADIUS,
      sunPosition: vec(SUN_DISTANCE, 0, 0),
      maxDistance,
    });
    camera.position.set(shot.position.x, shot.position.y, shot.position.z);
    controls.target.set(0, 0, 0);
    controls.update();
    state.aspect = aspect;
    state.pendingSince = Number.NaN;
  }, PRIORITY.update);

  return null;
}
