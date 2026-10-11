import { describe, expect, it } from 'vitest';
import { skyExposure } from './skyExposure';

describe('skyExposure', () => {
  it('uses daylight exposure with the Sun up', () => {
    expect(skyExposure(45)).toBe(10);
    expect(skyExposure(0)).toBe(10);
  });

  it('is fully night-adapted after astronomical twilight', () => {
    expect(skyExposure(-18)).toBeCloseTo(10_000, 6);
    expect(skyExposure(-40)).toBeCloseTo(10_000, 6);
  });

  it('rises monotonically through twilight', () => {
    let prev = skyExposure(0);
    for (let alt = -1; alt >= -18; alt--) {
      const e = skyExposure(alt);
      expect(e).toBeGreaterThan(prev);
      prev = e;
    }
  });
});
