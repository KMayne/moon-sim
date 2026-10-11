import { describe, expect, it } from 'vitest';
import { computeSystemState } from '../astro/ephemeris';
import { length, mulVec, scale, sub } from '../astro/vec';
import { ORBIT_PATH_SAMPLES, sampleMoonOrbitEqj } from './orbitPath';
import { KM_TO_SCENE, toOrbitScene } from './orbitScene';

describe('sampleMoonOrbitEqj', () => {
  const centre = Date.UTC(2026, 6, 4, 6);
  const path = sampleMoonOrbitEqj(centre);

  it('has an odd sample count with the current Moon in the middle', () => {
    expect(path).toHaveLength(ORBIT_PATH_SAMPLES + 1);
    const middle = path[ORBIT_PATH_SAMPLES / 2];
    expect(middle).toEqual(computeSystemState(new Date(centre)).moon);
  });

  it('lies at lunar distance (~56–64 Earth radii in the scene)', () => {
    for (const p of path) {
      const r = length(p) * KM_TO_SCENE;
      expect(r).toBeGreaterThan(55);
      expect(r).toBeLessThan(64.5);
    }
  });

  it('nearly closes after one sidereal month', () => {
    const first = path[0];
    const last = path[path.length - 1];
    if (!first || !last) throw new Error('empty path');
    // Perturbations and apsidal motion keep it from closing exactly; a few % of the radius at most.
    expect(length(sub(first, last)) / length(first)).toBeLessThan(0.08);
  });

  it('maps through eqjToScene onto the rendered Moon position', () => {
    const scene = toOrbitScene(computeSystemState(new Date(centre)));
    const middle = path[ORBIT_PATH_SAMPLES / 2];
    if (!middle) throw new Error('empty path');
    const placed = mulVec(scene.eqjToScene, scale(middle, KM_TO_SCENE));
    expect(length(sub(placed, scene.moon.position))).toBeLessThan(1e-9);
  });
});
