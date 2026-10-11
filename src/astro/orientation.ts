import { Rotation_EQJ_EQD, SiderealTime, type AxisInfo } from 'astronomy-engine';
import {
  cross,
  fromAstroRotation,
  fromColumns,
  mul,
  normalize,
  transpose,
  vec,
  type Mat3,
  type Vec3,
} from './vec';

const DEG = Math.PI / 180;
const HOUR = 15 * DEG;

/**
 * Body-fixed → EQJ rotation from IAU WGCCRE rotational elements (α0, δ0, W).
 *
 * Body frame: +z = north pole, +x = prime meridian on the equator (lat 0, lon 0),
 * +y = 90° east. W is measured eastward along the body's equator from its ascending node on the
 * J2000 equator, which lies at right ascension α0 + 90°.
 */
export function bodyOrientation(axis: AxisInfo): Mat3 {
  const pole: Vec3 = normalize(vec(axis.north.x, axis.north.y, axis.north.z));
  const nodeRa = axis.ra * HOUR + Math.PI / 2;
  const node = vec(Math.cos(nodeRa), Math.sin(nodeRa), 0);
  const nodeEast = cross(pole, node);

  const w = axis.spin * DEG;
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const primeMeridian = vec(
    node.x * cw + nodeEast.x * sw,
    node.y * cw + nodeEast.y * sw,
    node.z * cw + nodeEast.z * sw,
  );
  const east = cross(pole, primeMeridian);

  return fromColumns(primeMeridian, east, pole);
}

/**
 * Earth-fixed → EQJ: precession and nutation (EQD → EQJ) times rotation by Greenwich apparent
 * sidereal time. Polar motion (< 1″) is ignored.
 *
 * Used instead of the IAU WGCCRE Earth model, which the WGCCRE report itself describes as low
 * precision: its spin origin drifts from the true Greenwich meridian by ~0.4° by 2026, enough to
 * misplace the Sun and Moon visibly in the sky view.
 */
export function earthOrientation(time: Date): Mat3 {
  const eqdToEqj = transpose(fromAstroRotation(Rotation_EQJ_EQD(time)));
  const gast = SiderealTime(time) * HOUR;
  const c = Math.cos(gast);
  const s = Math.sin(gast);
  // Columns in EQD: Greenwich meridian, 90° E, north pole.
  const spin = fromColumns(vec(c, s, 0), vec(-s, c, 0), vec(0, 0, 1));
  return mul(eqdToEqj, spin);
}
