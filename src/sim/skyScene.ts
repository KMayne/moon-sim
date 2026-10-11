import { MOON_RADIUS_KM, SUN_RADIUS_KM } from '../astro/constants';
import type { SystemState } from '../astro/ephemeris';
import {
  altAz,
  ecefToHorizon,
  eqjToHorizon,
  observerEcefKm,
  topocentric,
  type AltAz,
  type Geodetic,
} from '../astro/observer';
import { length, mul, mulVec, normalize, transpose, type Mat3, type Vec3 } from '../astro/vec';
import { vecToThree, Z_UP_TO_THREE } from './axes';
import { lunarToSolarRatio, moonlightOnGround } from './moonlight';

/**
 * The sky as seen by an observer. World axes (three, Y-up) are the observer's local
 * North-Up-East frame: +x north, +y zenith, +z east. The observer stands at the origin.
 */
export interface SkyScene {
  /** EQJ → sky world. Rotates anything inertial (stars, orbit samples) onto the sky. */
  readonly eqjToSky: Mat3;
  /** Sky world → Earth-fixed (ECEF) rotation, for the atmosphere renderer. */
  readonly skyToEcef: Mat3;
  /** Observer's Earth-fixed position, metres. */
  readonly observerEcefM: Vec3;
  /** Unit vector to the Sun, sky world (topocentric). */
  readonly sunDirection: Vec3;
  /** Unit vector to the Sun, Earth-fixed — what the atmosphere shader expects. */
  readonly sunDirectionEcef: Vec3;
  readonly sun: AltAz;
  /** Unit vector to the Moon, sky world (topocentric, so includes parallax). */
  readonly moonDirection: Vec3;
  /** Unit vector to the Moon, Earth-fixed — for lighting the atmosphere by moonlight. */
  readonly moonDirectionEcef: Vec3;
  /** Moonlight relative to sunlight outside the atmosphere (see sim/moonlight.ts). */
  readonly lunarToSolar: number;
  /** Direct moonlight on the ground, relative to an overhead Sun outside the atmosphere. */
  readonly moonlightOnGround: number;
  readonly moon: AltAz;
  /** Rendered angular radius of the Moon: true topocentric value × the body-size visual aid. */
  readonly moonAngularRadius: number;
  /** Rendered angular radius of the Sun's disc: true value × the body-size visual aid. */
  readonly sunAngularRadius: number;
  /** Moon body-fixed (three-axis convention, see axes.ts) → sky world. */
  readonly moonRotation: Mat3;
}

export interface SkyVisualAids {
  /** Visual aid only; 1 = true size. */
  readonly bodySize: number;
}

export function toSkyScene(
  state: SystemState,
  observer: Geodetic,
  { bodySize }: SkyVisualAids,
): SkyScene {
  const eqjToHor = eqjToHorizon(state.earthOrientation, observer);
  const eqjToSky = mul(Z_UP_TO_THREE, eqjToHor);
  const skyToEcef = transpose(mul(Z_UP_TO_THREE, ecefToHorizon(observer)));

  const sunTopo = topocentric(state.sun, state.earthOrientation, observer);
  const moonTopo = topocentric(state.moon, state.earthOrientation, observer);
  const sunHor = mulVec(eqjToHor, sunTopo);
  const moonHor = mulVec(eqjToHor, moonTopo);
  const moon = altAz(moonHor);
  const lunarToSolar = lunarToSolarRatio(state.time);

  return {
    eqjToSky,
    skyToEcef,
    observerEcefM: scaleKmToM(observerEcefKm(observer)),
    sunDirection: normalize(vecToThree(sunHor)),
    sunDirectionEcef: normalize(mulVec(transpose(state.earthOrientation), sunTopo)),
    sun: altAz(sunHor),
    moonDirection: normalize(vecToThree(moonHor)),
    moonDirectionEcef: normalize(mulVec(transpose(state.earthOrientation), moonTopo)),
    lunarToSolar,
    moonlightOnGround: moonlightOnGround(lunarToSolar, moon.altitude),
    moon,
    moonAngularRadius: Math.asin(MOON_RADIUS_KM / length(moonTopo)) * bodySize,
    sunAngularRadius: Math.asin(SUN_RADIUS_KM / length(sunTopo)) * bodySize,
    moonRotation: mul(mul(eqjToSky, state.moonOrientation), transpose(Z_UP_TO_THREE)),
  };
}

const scaleKmToM = (v: Vec3): Vec3 => ({ x: v.x * 1000, y: v.y * 1000, z: v.z * 1000 });
