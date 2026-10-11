import { Rotation_EQJ_ECL } from 'astronomy-engine';
import {
  column,
  cross,
  fromAstroRotation,
  fromRows,
  normalize,
  transpose,
  type Mat3,
  type Vec3,
} from './vec';

/** J2000 ecliptic north pole in EQJ: the z column of ECL→EQJ. */
export const ECLIPTIC_POLE_EQJ: Vec3 = column(transpose(fromAstroRotation(Rotation_EQJ_ECL())), 2);

/**
 * EQJ → Sun-fixed frame: +x toward the Sun, +z ecliptic north, +y completes a right-handed set.
 * In this frame the Sun never moves, so Earth's visible spin rate is the solar day.
 */
export function sunFixedFrame(sunEqj: Vec3): Mat3 {
  const x = normalize(sunEqj);
  const y = normalize(cross(ECLIPTIC_POLE_EQJ, x));
  const z = cross(x, y);
  return fromRows(x, y, z);
}
