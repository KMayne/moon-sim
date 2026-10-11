import { MEAN_SIDEREAL_MONTH_DAYS, MS_PER_DAY } from '../astro/constants';
import { moonPositionKm } from '../astro/ephemeris';
import type { Vec3 } from '../astro/vec';

export const ORBIT_PATH_SAMPLES = 180;

/**
 * The Moon's path over one sidereal month centred on `centreMs`, as geocentric EQJ positions (km).
 *
 * Kept in the inertial frame on purpose: the renderer orients it with the current frame's
 * `eqjToScene` every frame (cheap), and only resamples when sim time has moved on (expensive).
 * The middle sample is exactly the Moon's position at `centreMs`.
 */
export function sampleMoonOrbitEqj(centreMs: number, samples = ORBIT_PATH_SAMPLES): Vec3[] {
  const spanMs = MEAN_SIDEREAL_MONTH_DAYS * MS_PER_DAY;
  const half = Math.floor(samples / 2);
  return Array.from({ length: 2 * half + 1 }, (_, i) =>
    moonPositionKm(new Date(centreMs + ((i - half) / (2 * half)) * spanMs)),
  );
}
