import { mul, mulVec, transpose, type Mat3, type Vec3 } from '../astro/vec';

/**
 * The one place Z-up physics frames meet three.js's Y-up convention.
 *
 * physics (x, y, z) → three (x, z, −y). This is a proper rotation (−90° about x), so handedness is
 * preserved. It applies equally to body-fixed frames, so a sphere mesh's local axes are:
 *   three +x = lon 0 on the equator, three +y = north pole, three −z = 90° E.
 * That matches three's SphereGeometry UVs for an equirectangular map centred on lon 0.
 */
export const Z_UP_TO_THREE: Mat3 = [
  [1, 0, 0],
  [0, 0, 1],
  [0, -1, 0],
];

export const vecToThree = (v: Vec3): Vec3 => mulVec(Z_UP_TO_THREE, v);

/** Re-express a rotation between Z-up frames as one between the corresponding Y-up frames. */
export const rotationToThree = (m: Mat3): Mat3 =>
  mul(mul(Z_UP_TO_THREE, m), transpose(Z_UP_TO_THREE));
