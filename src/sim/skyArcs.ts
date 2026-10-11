import { Body, GeoMoon, GeoVector } from 'astronomy-engine';
import { KM_PER_AU } from '../astro/constants';
import { eqjToHorizon, topocentric, type Geodetic } from '../astro/observer';
import { earthOrientation } from '../astro/orientation';
import { fromAstro, mulVec, normalize, scale, type Vec3 } from '../astro/vec';
import { vecToThree } from './axes';

const HOUR_MS = 3_600_000;
export const ARC_HALF_SPAN_MS = 12 * HOUR_MS;
export const ARC_STEP_MS = 10 * 60_000;

export interface DailyArcs {
  /** Unit directions in sky world (see skyScene.ts), one per sample, oldest first. */
  readonly sun: Vec3[];
  readonly moon: Vec3[];
  /** Index of the sample at `centreMs` (the bodies' current positions). */
  readonly centreIndex: number;
}

/**
 * Sun and Moon paths across the observer's sky over ±12 h of `centreMs`. Each sample uses that
 * instant's Earth orientation, so the arcs are the true diurnal paths, including the Moon's
 * eastward drift (~13°/day) against the sky.
 */
export function sampleDailyArcs(centreMs: number, observer: Geodetic): DailyArcs {
  const sun: Vec3[] = [];
  const moon: Vec3[] = [];
  const n = Math.round(ARC_HALF_SPAN_MS / ARC_STEP_MS);
  for (let i = -n; i <= n; i++) {
    const time = new Date(centreMs + i * ARC_STEP_MS);
    const earth = earthOrientation(time);
    const toHor = eqjToHorizon(earth, observer);
    const toSky = (geoAu: Vec3) =>
      normalize(vecToThree(mulVec(toHor, topocentric(scale(geoAu, KM_PER_AU), earth, observer))));
    sun.push(toSky(fromAstro(GeoVector(Body.Sun, time, true))));
    moon.push(toSky(fromAstro(GeoMoon(time))));
  }
  return { sun, moon, centreIndex: n };
}
