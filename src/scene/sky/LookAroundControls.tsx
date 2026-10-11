import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, type RefObject } from 'react';
import type { PerspectiveCamera } from 'three';
import {
  DEFAULT_SKY_FOV,
  defaultSkyLook,
  normalizeSkyLook,
  sameView,
  SKY_ALTITUDE_RANGE,
  SKY_FOV_RANGE,
  type SkyLook,
} from '../../sim/cameraViews';
import { useSimStore } from '../../state/store';

const DEG = Math.PI / 180;
const MIN_ALT = SKY_ALTITUDE_RANGE.min * DEG;
const MAX_ALT = SKY_ALTITUDE_RANGE.max * DEG;
export const DEFAULT_FOV = DEFAULT_SKY_FOV;

interface View {
  /** Radians clockwise from north. */
  azimuth: number;
  altitude: number;
  fov: number;
}

const toView = (look: SkyLook): View => ({
  azimuth: look.azimuthDeg * DEG,
  altitude: look.altitudeDeg * DEG,
  fov: look.fovDeg,
});

const toLook = ({ azimuth, altitude, fov }: View): SkyLook =>
  normalizeSkyLook({ azimuthDeg: azimuth / DEG, altitudeDeg: altitude / DEG, fovDeg: fov });

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Turntable look-around for an observer at the origin: drag to turn (azimuth) and tilt
 * (altitude), wheel or pinch to zoom (field of view). No roll, so the horizon always stays level.
 * Starts from the store's `skyLook` (e.g. from a shared link) and records every move there. Resets
 * to the default view when the observer's location changes.
 */
export function LookAroundControls({ element }: { element: RefObject<HTMLElement | null> }) {
  const location = useSimStore((s) => s.location);
  const view = useRef<View>(
    toView(useSimStore.getState().skyLook ?? defaultSkyLook(location.latitude)),
  );
  const lastLocation = useRef(location);

  useEffect(() => {
    // Not on mount: a shared link's view must survive the first render.
    if (location === lastLocation.current) return;
    lastLocation.current = location;
    view.current = toView(defaultSkyLook(location.latitude));
    useSimStore.getState().setSkyLook(null);
  }, [location]);

  useEffect(() => {
    const el = element.current;
    if (!el) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDistance = 0;
    /** Store only real changes: pointer moves far outnumber 0.1° steps. */
    const record = () => {
      const { skyLook, setSkyLook } = useSimStore.getState();
      const look = toLook(view.current);
      if (!sameView(look, skyLook)) setSkyLook(look);
    };

    const radiansPerPixel = () => (view.current.fov * DEG) / Math.max(1, el.clientHeight);
    const zoom = (factor: number) => {
      view.current.fov = clamp(view.current.fov * factor, SKY_FOV_RANGE.min, SKY_FOV_RANGE.max);
      record();
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
        const v = view.current;
        v.azimuth -= (e.clientX - prev.x) * k;
        v.altitude = clamp(v.altitude + (e.clientY - prev.y) * k, MIN_ALT, MAX_ALT);
        record();
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
