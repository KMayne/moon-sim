import type { SystemState } from '../astro/ephemeris';
import {
  column,
  cross,
  dot,
  fromColumns,
  mulVec,
  normalize,
  scale,
  sub,
  vec,
  type Mat3,
  type Vec3,
} from '../astro/vec';
import type { SkyScene } from './skyScene';

/**
 * The Moon "as seen by the observer, magnified": a close-up of the same Moon the sky view shows,
 * in the sky view's world frame (x north, y zenith, z east), with the Moon at the origin.
 *
 * The camera looks from the observer's side along the topocentric line of sight, with the
 * observer's zenith (projected onto the sky plane) as "up" — so the disc is rotated exactly as the
 * Moon appears in the sky at that moment, and the lit side tilts through the night.
 */
export interface DiscScene {
  /** Camera local → world (columns: right, up, back), for applyRotation. */
  readonly cameraRotation: Mat3;
  /** Camera position, Moon radii from the Moon's centre. */
  readonly cameraPosition: Vec3;
  /** Moon body-fixed (three-axis convention) → world: the sky view's true orientation. */
  readonly moonRotation: Mat3;
  /** Unit vector from the Moon toward the Sun, world. */
  readonly sunDirection: Vec3;
  /** Unit vector from the Moon toward the observer (and camera), world. */
  readonly viewDirection: Vec3;
  /**
   * Earth's illuminated fraction as seen from the Moon: the strength of earthshine (physical
   * quantity, 0–1; the renderer applies a display gain).
   */
  readonly earthLitFraction: number;
  /** What "up" in the disc means: the zenith, or celestial north if the Moon is at the zenith. */
  readonly up: 'zenith' | 'north';
  /** Moon's altitude for this observer, degrees (negative: below the horizon). */
  readonly moonAltitudeDeg: number;
}

/** Camera distance in Moon radii; orthographic, so only clipping depends on it. */
export const DISC_CAMERA_DISTANCE = 10;

const ZENITH = vec(0, 1, 0);
const NORTH = vec(1, 0, 0);

/** Component of `v` perpendicular to unit `axis`. */
const perpendicular = (v: Vec3, axis: Vec3): Vec3 => sub(v, scale(axis, dot(v, axis)));

export function toDiscScene(state: SystemState, sky: SkyScene): DiscScene {
  const forward = sky.moonDirection;
  // Zenith projected onto the sky plane. Degenerate only within ~0.5° of the zenith.
  const zenithOnSky = perpendicular(ZENITH, forward);
  const useZenith = Math.hypot(zenithOnSky.x, zenithOnSky.y, zenithOnSky.z) > 1e-2;
  const up = normalize(useZenith ? zenithOnSky : perpendicular(NORTH, forward));
  const right = cross(forward, up);
  const back = scale(forward, -1);

  // Sun − Moon is the same topocentric or geocentric: the observer offset cancels.
  const sunDirection = normalize(mulVec(sky.eqjToSky, sub(state.sun, state.moon)));
  const cosElongation = dot(normalize(state.sun), normalize(state.moon));

  return {
    cameraRotation: fromColumns(right, up, back),
    cameraPosition: scale(back, DISC_CAMERA_DISTANCE),
    moonRotation: sky.moonRotation,
    sunDirection,
    viewDirection: back,
    earthLitFraction: (1 + cosElongation) / 2,
    up: useZenith ? 'zenith' : 'north',
    moonAltitudeDeg: sky.moon.altitude,
  };
}

/**
 * Position angle of the bright limb in the disc: the direction of the Sun projected onto the sky
 * plane, in degrees clockwise from the disc's "up" (as seen on screen: 90° = right).
 */
export function brightLimbAngleDeg(disc: DiscScene): number {
  const right = column(disc.cameraRotation, 0);
  const up = column(disc.cameraRotation, 1);
  const onSky = perpendicular(disc.sunDirection, disc.viewDirection);
  return (Math.atan2(dot(onSky, right), dot(onSky, up)) * 180) / Math.PI;
}

/**
 * Fraction of the visible disc's area that is sunlit, by sampling the orthographic projection.
 * The renderer lights exactly these points (n·sun > 0).
 */
export function litDiscFraction(disc: DiscScene, samplesPerAxis = 400): number {
  const right = column(disc.cameraRotation, 0);
  const up = column(disc.cameraRotation, 1);
  const towardCamera = disc.viewDirection;
  let inside = 0;
  let lit = 0;
  for (let i = 0; i < samplesPerAxis; i++) {
    const x = ((i + 0.5) / samplesPerAxis) * 2 - 1;
    for (let j = 0; j < samplesPerAxis; j++) {
      const y = ((j + 0.5) / samplesPerAxis) * 2 - 1;
      const r2 = x * x + y * y;
      if (r2 >= 1) continue;
      inside++;
      const z = Math.sqrt(1 - r2);
      const n = vec(
        right.x * x + up.x * y + towardCamera.x * z,
        right.y * x + up.y * y + towardCamera.y * z,
        right.z * x + up.z * y + towardCamera.z * z,
      );
      if (dot(n, disc.sunDirection) > 0) lit++;
    }
  }
  return lit / inside;
}
