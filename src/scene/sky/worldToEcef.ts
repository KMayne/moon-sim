import type { Matrix4 } from 'three';
import type { Mat3, Vec3 } from '../../astro/vec';

/** Sky world → ECEF (metres), as takram's `worldToECEFMatrix`. */
export function setWorldToEcef(target: Matrix4, skyToEcef: Mat3, observerEcefM: Vec3): void {
  const m = skyToEcef;
  target.set(
    m[0][0], m[0][1], m[0][2], observerEcefM.x,
    m[1][0], m[1][1], m[1][2], observerEcefM.y,
    m[2][0], m[2][1], m[2][2], observerEcefM.z,
    0, 0, 0, 1,
  ); // prettier-ignore
}
