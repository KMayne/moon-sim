import { describe, expect, it } from 'vitest';
import { auroraIntensity, auroraStatus } from './auroraVisibility';

describe('auroraIntensity', () => {
  it('is off south of 60°N, including the whole southern hemisphere', () => {
    expect(auroraIntensity(59.9, -30)).toBe(0);
    expect(auroraIntensity(19.82, -30)).toBe(0); // Mauna Kea
    expect(auroraIntensity(-24.63, -30)).toBe(0); // Paranal
    expect(auroraIntensity(-75, -30)).toBe(0);
  });

  it('is off in daylight and civil twilight at high latitude', () => {
    expect(auroraIntensity(69.65, 10)).toBe(0);
    expect(auroraIntensity(69.65, -6)).toBe(0);
  });

  it('fades in through nautical twilight and is full when dark', () => {
    const mid = auroraIntensity(69.65, -9);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(auroraIntensity(69.65, -12)).toBe(1);
    expect(auroraIntensity(69.65, -40)).toBe(1);
  });

  it('rises monotonically as the Sun sinks', () => {
    let previous = 0;
    for (let alt = -5; alt >= -13; alt -= 0.25) {
      const value = auroraIntensity(69.65, alt);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe('auroraStatus', () => {
  it('explains why the aurora is hidden', () => {
    expect(auroraStatus(-24.63, -30)).toBe('too-far-south');
    expect(auroraStatus(69.65, 5)).toBe('not-dark');
    expect(auroraStatus(69.65, -9)).toBe('visible');
    expect(auroraStatus(69.65, -30)).toBe('visible');
  });
});
