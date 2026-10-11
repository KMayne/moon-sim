import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, type RefObject } from 'react';
import type { PerspectiveCamera } from 'three';
import { useSimStore } from '../../state/store';

const DEG = Math.PI / 180;
const MIN_ALT = -10 * DEG;
const MAX_ALT = 89.5 * DEG;
const MIN_FOV = 10;
const MAX_FOV = 100;
export const DEFAULT_FOV = 70;
const DEFAULT_ALT = 20 * DEG;

interface View {
  /** Radians clockwise from north. */
  azimuth: number;
  altitude: number;
  fov: number;
}

/**
 * Equator-facing: that's where the Sun and Moon culminate, so their whole daily arcs are in view.
 * South from the northern hemisphere, north from the southern.
 */
const defaultView = (latitude: number): View => ({
  azimuth: latitude >= 0 ? Math.PI : 0,
  altitude: DEFAULT_ALT,
  fov: DEFAULT_FOV,
});

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Turntable look-around for an observer at the origin: drag to turn (azimuth) and tilt
 * (altitude), wheel or pinch to zoom (field of view). No roll, so the horizon always stays level.
 * Resets to the default view when the observer's location changes.
 */
export function LookAroundControls({ element }: { element: RefObject<HTMLElement | null> }) {
  const location = useSimStore((s) => s.location);
  const view = useRef<View>(defaultView(location.latitude));

  useEffect(() => {
    view.current = defaultView(location.latitude);
  }, [location]);

  useEffect(() => {
    const el = element.current;
    if (!el) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDistance = 0;

    const radiansPerPixel = () => (view.current.fov * DEG) / Math.max(1, el.clientHeight);
    const zoom = (factor: number) => {
      view.current.fov = clamp(view.current.fov * factor, MIN_FOV, MAX_FOV);
    };
    const spread = () => {
      const [a, b] = [...pointers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };

    const onDown = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) pinchDistance = spread();
    };
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        // Grab-the-sky: content follows the pointer.
        const k = radiansPerPixel();
        view.current.azimuth -= (e.clientX - prev.x) * k;
        view.current.altitude = clamp(
          view.current.altitude + (e.clientY - prev.y) * k,
          MIN_ALT,
          MAX_ALT,
        );
      } else if (pointers.size === 2) {
        const d = spread();
        if (pinchDistance > 0 && d > 0) zoom(pinchDistance / d);
        pinchDistance = d;
      }
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinchDistance = pointers.size === 2 ? spread() : 0;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom(Math.exp(e.deltaY * 0.001));
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, [element]);

  useFrame(({ camera }) => {
    if (!(camera as PerspectiveCamera).isPerspectiveCamera) return;
    const cam = camera as PerspectiveCamera;
    const { azimuth, altitude, fov } = view.current;
    // Sky world: +x north, +y up, +z east; the camera looks down its −z. Yaw then pitch, no roll.
    cam.rotation.set(altitude, -(azimuth + Math.PI / 2), 0, 'YXZ');
    if (cam.fov !== fov) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  });

  return null;
}
