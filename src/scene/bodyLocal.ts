import { Vector3 } from 'three';

/**
 * Points on a unit body sphere in its local (three-axis) frame. See sim/axes.ts:
 * +x = lat 0 lon 0, +y = north pole, −z = 90° E.
 */
export function localSurfacePoint(latDeg: number, lonDeg: number): Vector3 {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return new Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
}

/** Moon's near-side marker: the mean sub-Earth point. */
export const NEAR_SIDE_POINT = localSurfacePoint(0, 0);

/** Earth's Greenwich marker. */
export const GREENWICH_POINT = localSurfacePoint(0, 0);
