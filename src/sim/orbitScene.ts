import { EARTH_RADIUS_KM, MOON_RADIUS_KM } from '../astro/constants';
import type { SystemState } from '../astro/ephemeris';
import { sunFixedFrame } from '../astro/frames';
import { mul, mulVec, normalize, scale, type Mat3, type Vec3 } from '../astro/vec';
import { rotationToThree, vecToThree, Z_UP_TO_THREE } from './axes';

/** A body placed in a three.js scene. Units: Earth equatorial radii; axes: three (Y-up). */
export interface BodyTransform {
  readonly position: Vec3;
  /** Body-fixed (three-axis convention, see axes.ts) → scene. Row-major. */
  readonly rotation: Mat3;
  readonly radius: number;
}

export interface OrbitScene {
  readonly earth: BodyTransform;
  readonly moon: BodyTransform;
  /** Unit vector toward the Sun. Constant (+x) by construction of the Sun-fixed frame. */
  readonly sunDirection: Vec3;
  /** EQJ → scene axes (multiply km by KM_TO_SCENE too), e.g. for orbit path samples. */
  readonly eqjToScene: Mat3;
}

export const KM_TO_SCENE = 1 / EARTH_RADIUS_KM;

/**
 * Geocentric, Sun-fixed scene: Earth at the origin, Sun along +x, ecliptic north up.
 * Everything is true scale.
 */
export function toOrbitScene(state: SystemState): OrbitScene {
  const eqjToSunFixed = sunFixedFrame(state.sun);
  const place = (eqjKm: Vec3): Vec3 => vecToThree(mulVec(eqjToSunFixed, scale(eqjKm, KM_TO_SCENE)));
  const orient = (bodyToEqj: Mat3): Mat3 => rotationToThree(mul(eqjToSunFixed, bodyToEqj));

  return {
    earth: {
      position: { x: 0, y: 0, z: 0 },
      rotation: orient(state.earthOrientation),
      radius: 1,
    },
    moon: {
      position: place(state.moon),
      rotation: orient(state.moonOrientation),
      radius: MOON_RADIUS_KM * KM_TO_SCENE,
    },
    sunDirection: normalize(place(state.sun)),
    eqjToScene: mul(Z_UP_TO_THREE, eqjToSunFixed),
  };
}
