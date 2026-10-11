import { describe, expect, it } from 'vitest';
import {
  GROUND_ALBEDO,
  groundRadiance,
  NIGHT_FLOOR_MAX,
  nightFloor,
  nightFloorWeight,
} from './groundLight';

const ZERO = { x: 0, y: 0, z: 0 };
const ONE = { x: 1, y: 1, z: 1 };

describe('groundRadiance', () => {
  it('is albedo/π × (direct · sin(alt) + sky)', () => {
    const l = groundRadiance(ONE, { x: 2, y: 2, z: 2 }, 30, ONE);
    expect(l.x).toBeCloseTo((2 * 0.5 + 1) / Math.PI, 12);
  });

  it('drops the direct term below the horizon', () => {
    expect(groundRadiance(GROUND_ALBEDO, ONE, -5, ZERO)).toEqual(ZERO);
  });
});

describe('night floor (display-only)', () => {
  it('is off while the Sun is up', () => {
    for (const alt of [45, 5, 0]) expect(nightFloorWeight(alt)).toBe(0);
  });

  it('is already partly on in civil twilight, where ACES crushes dim ground to black', () => {
    const w = nightFloorWeight(-3);
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThan(0.5);
  });

  it('is fully on from the end of nautical twilight', () => {
    for (const alt of [-12, -18, -60]) expect(nightFloorWeight(alt)).toBe(1);
  });

  it('strengthens monotonically as the Sun sinks', () => {
    let prev = 0;
    for (let alt = 0; alt >= -12; alt -= 0.25) {
      const w = nightFloorWeight(alt);
      expect(w).toBeGreaterThanOrEqual(prev);
      prev = w;
    }
  });

  it('keeps the ground darker than the sky at the horizon, at every strength', () => {
    for (let alt = 0; alt >= -20; alt -= 0.5) {
      const f = nightFloor(alt);
      expect(f.groundHorizon).toBeLessThanOrEqual(f.skyHorizon);
      expect(f.ground).toBeLessThanOrEqual(f.groundHorizon);
    }
    expect(NIGHT_FLOOR_MAX.groundHorizon).toBeLessThan(NIGHT_FLOOR_MAX.skyHorizon * 0.75);
  });

  it('brightens the sky toward the horizon, like airglow', () => {
    expect(NIGHT_FLOOR_MAX.skyHorizon).toBeGreaterThan(NIGHT_FLOOR_MAX.skyZenith);
  });

  it('stays understated', () => {
    for (const v of Object.values(NIGHT_FLOOR_MAX)) expect(v).toBeLessThan(0.15);
  });
});
