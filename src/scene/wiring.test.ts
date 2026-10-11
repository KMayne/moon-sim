import { Group, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { computeSystemState } from '../astro/ephemeris';
import { toOrbitScene } from '../sim/orbitScene';
import { applyTransform } from './applyTransform';
import { GREENWICH_POINT, NEAR_SIDE_POINT } from './bodyLocal';

/**
 * These tests go through the same path as rendering: sim state → applyTransform → three Object3D
 * → world space. They catch transposed matrices, axis-convention slips and wrong marker placement
 * that pure sim tests cannot.
 */

const HOUR_MS = 3_600_000;
const DEG = 180 / Math.PI;

function placed(ms: number) {
  const orbit = toOrbitScene(computeSystemState(new Date(ms)));
  const earth = new Group();
  const moon = new Group();
  applyTransform(earth, orbit.earth);
  applyTransform(moon, orbit.moon);
  earth.updateMatrixWorld();
  moon.updateMatrixWorld();
  const sun = new Vector3(orbit.sunDirection.x, orbit.sunDirection.y, orbit.sunDirection.z);
  return { earth, moon, sun };
}

/** World direction of a local surface point, from the body's centre. */
const outward = (body: Group, local: Vector3): Vector3 =>
  body.localToWorld(local.clone()).sub(body.position).normalize();

describe('rendered scene graph', () => {
  it('near-side marker faces Earth throughout a month', () => {
    const start = Date.UTC(2026, 3, 1);
    for (let t = start; t < start + 30 * 24 * HOUR_MS; t += HOUR_MS) {
      const { earth, moon } = placed(t);
      const towardEarth = earth.position.clone().sub(moon.position).normalize();
      expect(outward(moon, NEAR_SIDE_POINT).angleTo(towardEarth) * DEG).toBeLessThan(11);
    }
  });

  it('near-side marker sits one Moon radius from the Moon centre', () => {
    const { moon } = placed(Date.UTC(2026, 3, 1));
    const markerWorld = moon.localToWorld(NEAR_SIDE_POINT.clone());
    expect(markerWorld.distanceTo(moon.position)).toBeCloseTo(0.2724, 3);
  });

  it('Greenwich faces the Sun at noon UTC and away at midnight', () => {
    const noon = placed(Date.UTC(2026, 5, 21, 12));
    const midnight = placed(Date.UTC(2026, 5, 21, 0));
    // Within the equation of time plus the 23° tilt of the noon meridian toward the summer Sun.
    expect(outward(noon.earth, GREENWICH_POINT).angleTo(noon.sun) * DEG).toBeLessThan(30);
    expect(outward(midnight.earth, GREENWICH_POINT).angleTo(midnight.sun) * DEG).toBeGreaterThan(
      150,
    );
  });

  it("Earth's north pole tilts 23.44° from ecliptic north (scene +y)", () => {
    const { earth } = placed(Date.UTC(2026, 5, 21, 12));
    const pole = outward(earth, new Vector3(0, 1, 0));
    expect(pole.angleTo(new Vector3(0, 1, 0)) * DEG).toBeCloseTo(23.44, 1);
    // June solstice: northern hemisphere tilted toward the Sun.
    expect(pole.x).toBeGreaterThan(0);
  });
});
