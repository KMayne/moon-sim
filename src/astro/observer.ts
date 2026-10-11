import { cross, fromRows, mul, mulVec, sub, transpose, vec, type Mat3, type Vec3 } from './vec';

/** A point on Earth's surface: WGS 84 geodetic degrees (east, north positive), metres above it. */
export interface Geodetic {
  readonly latitude: number;
  readonly longitude: number;
  readonly heightM?: number;
}

const WGS84_A_KM = 6378.137;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = WGS84_F * (2 - WGS84_F);
const DEG = Math.PI / 180;

/** Observer position in Earth-fixed coordinates (km). Earth-fixed = our Earth body frame. */
export function observerEcefKm({ latitude, longitude, heightM = 0 }: Geodetic): Vec3 {
  const lat = latitude * DEG;
  const lon = longitude * DEG;
  const sinLat = Math.sin(lat);
  const n = WGS84_A_KM / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const h = heightM / 1000;
  return vec(
    (n + h) * Math.cos(lat) * Math.cos(lon),
    (n + h) * Math.cos(lat) * Math.sin(lon),
    (n * (1 - WGS84_E2) + h) * sinLat,
  );
}

/**
 * Earth-fixed → horizontal (HOR), astronomy-engine's convention: +x north, +y west, +z zenith
 * (along the geodetic normal).
 */
export function ecefToHorizon({ latitude, longitude }: Geodetic): Mat3 {
  const lat = latitude * DEG;
  const lon = longitude * DEG;
  const up = vec(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat));
  const north = vec(-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat));
  const west = cross(up, north);
  return fromRows(north, west, up);
}

/** EQJ → horizontal, through the same Earth orientation that drives the orbit view. */
export const eqjToHorizon = (earthOrientation: Mat3, observer: Geodetic): Mat3 =>
  mul(ecefToHorizon(observer), transpose(earthOrientation));

/** Observer-centred EQJ vector (km) to a body, from its geocentric EQJ vector: removes parallax. */
export const topocentric = (geoEqjKm: Vec3, earthOrientation: Mat3, observer: Geodetic): Vec3 =>
  sub(geoEqjKm, mulVec(earthOrientation, observerEcefKm(observer)));

export interface AltAz {
  /** Degrees above the (geometric) horizon. */
  readonly altitude: number;
  /** Degrees clockwise from north: east = 90. */
  readonly azimuth: number;
}

export function altAz(hor: Vec3): AltAz {
  const r = Math.hypot(hor.x, hor.y, hor.z);
  const azimuth = Math.atan2(-hor.y, hor.x) / DEG;
  return {
    altitude: Math.asin(hor.z / r) / DEG,
    azimuth: (azimuth + 360) % 360,
  };
}
