import { Body, GeoMoon, GeoVector, RotationAxis } from 'astronomy-engine';
import { KM_PER_AU } from './constants';
import { bodyOrientation } from './orientation';
import { fromAstro, scale, type Mat3, type Vec3 } from './vec';

/**
 * Everything the views need about the Earth–Moon–Sun system at one instant.
 * All vectors are geocentric, in the J2000 mean equator frame (EQJ), in km.
 */
export interface SystemState {
  readonly time: Date;
  readonly sun: Vec3;
  readonly moon: Vec3;
  /** Earth body-fixed → EQJ. Columns: Greenwich (lat 0, lon 0), 90° E, north pole. */
  readonly earthOrientation: Mat3;
  /** Moon body-fixed → EQJ. Column 0 is the mean sub-Earth point (lat 0, lon 0). */
  readonly moonOrientation: Mat3;
}

/** Geocentric Moon position in EQJ, km. */
export const moonPositionKm = (time: Date): Vec3 => scale(fromAstro(GeoMoon(time)), KM_PER_AU);

/** Pure function of time: no caching, no accumulation. */
export function computeSystemState(time: Date): SystemState {
  return {
    time,
    // Apparent direction (with aberration), as an observer on Earth would see it.
    sun: scale(fromAstro(GeoVector(Body.Sun, time, true)), KM_PER_AU),
    moon: moonPositionKm(time),
    earthOrientation: bodyOrientation(RotationAxis(Body.Earth, time)),
    moonOrientation: bodyOrientation(RotationAxis(Body.Moon, time)),
  };
}
