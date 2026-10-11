import { EARTH_RADIUS_KM, MOON_RADIUS_KM } from '../astro/constants';

/**
 * Render-time visual aids. 1 = true scale. They change how the Moon is drawn, never what the
 * astronomy computes.
 */
export interface VisualScale {
  /** Multiplies the Moon's rendered radius only. */
  readonly moonSize: number;
  /** Multiplies the Moon's rendered distance from Earth only (direction unchanged). */
  readonly moonDistance: number;
}

export const TRUE_SCALE: VisualScale = { moonSize: 1, moonDistance: 1 };

export const MOON_SIZE_RANGE = { min: 1, max: 25 } as const;
export const MOON_DISTANCE_RANGE = { min: 0.05, max: 1 } as const;

/** Below the closest lunar perigee of 1900–2100 (~356,375 km), so the guard holds at any date. */
const MIN_PERIGEE_KM = 356_000;
/** Minimum gap kept between the Earth and Moon surfaces, in Earth radii. */
const SURFACE_CLEARANCE_EARTH_RADII = 0.5;

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/** Smallest distance multiplier that keeps the scaled Moon clear of Earth at any perigee. */
export function minMoonDistance(moonSize: number): number {
  const clearanceKm =
    EARTH_RADIUS_KM * (1 + SURFACE_CLEARANCE_EARTH_RADII) + MOON_RADIUS_KM * moonSize;
  return clearanceKm / MIN_PERIGEE_KM;
}

/**
 * The scale actually rendered: requested values clamped to their ranges, with the distance raised
 * if needed so a large Moon brought close never intersects Earth. Constant for given settings (not
 * per-date), so the Moon and its orbit path share one uniform distance scale.
 */
export function resolveVisualScale(requested: VisualScale): VisualScale {
  const moonSize = clamp(requested.moonSize, MOON_SIZE_RANGE.min, MOON_SIZE_RANGE.max);
  const moonDistance = clamp(
    Math.max(requested.moonDistance, minMoonDistance(moonSize)),
    MOON_DISTANCE_RANGE.min,
    MOON_DISTANCE_RANGE.max,
  );
  return { moonSize, moonDistance };
}

export const isTrueScale = (s: VisualScale): boolean => s.moonSize === 1 && s.moonDistance === 1;
