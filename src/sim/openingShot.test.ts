import { describe, expect, it } from 'vitest';
import { vec } from '../astro/vec';
import { fitOpeningShot } from './openingShot';

const BASE = { fovDeg: 50, orbitRadius: 64, sunPosition: vec(1500, 0, 0) };

describe('fitOpeningShot', () => {
  for (const [name, aspect] of [
    ['desktop 1400×800 (minus sidebar)', 1100 / 800],
    ['ultrawide', 2.4],
    ['square', 1],
    ['portrait phone 390×844', 390 / 844],
  ] as const) {
    it(`frames the orbit and the Sun: ${name}`, () => {
      const shot = fitOpeningShot({ ...BASE, aspect });
      expect(shot.orbitHalfWidthNdc).toBeCloseTo(0.85, 2);
      expect(shot.sunInFrame).toBe(true);
      expect(shot.position.y).toBeGreaterThan(0);
    });
  }

  it('puts the Sun beside the orbit on wide screens and above it on narrow ones', () => {
    const wide = fitOpeningShot({ ...BASE, aspect: 2.4 });
    const narrow = fitOpeningShot({ ...BASE, aspect: 390 / 844 });
    expect(Math.abs(wide.sunNdc.x)).toBeGreaterThan(Math.abs(wide.sunNdc.y));
    expect(narrow.sunNdc.y).toBeGreaterThan(Math.abs(narrow.sunNdc.x));
  });

  it('stays within the camera distance limit', () => {
    const shot = fitOpeningShot({ ...BASE, aspect: 0.4, maxDistance: 1000 });
    expect(Math.hypot(shot.position.x, shot.position.y, shot.position.z)).toBeLessThanOrEqual(1000);
  });

  it('never fails on tiny or extreme viewports (best effort instead)', () => {
    for (const aspect of [0.2, 0.5, 1, 3, 6, 12]) {
      const shot = fitOpeningShot({
        aspect,
        fovDeg: 50,
        orbitRadius: 64,
        sunPosition: vec(1500, 0, 0),
        maxDistance: 1000,
      });
      expect(Number.isFinite(shot.position.x + shot.position.y + shot.position.z)).toBe(true);
    }
  });
});
