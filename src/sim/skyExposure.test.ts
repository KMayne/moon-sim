import { describe, expect, it } from 'vitest';
import { BRIGHT_MOONLIGHT } from './moonlight';
import { moonExposureBoost, NIGHT_EXPOSURE, skyExposure, starExposure } from './skyExposure';

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

  it('leaves a moonless night unchanged', () => {
    expect(skyExposure(-30, 0)).toBeCloseTo(NIGHT_EXPOSURE, 6);
    expect(skyExposure(-30, BRIGHT_MOONLIGHT * 1e-4)).toBeCloseTo(NIGHT_EXPOSURE, 6);
  });

  it('adapts further to moonlight at night, but not by day', () => {
    expect(skyExposure(-30, BRIGHT_MOONLIGHT)).toBeGreaterThan(10 * NIGHT_EXPOSURE);
    expect(skyExposure(30, BRIGHT_MOONLIGHT)).toBe(10);
  });

  it('shows brighter moonlight brighter (exposure × moonlight rises with moonlight)', () => {
    let prev = 0;
    for (let log = -3; log <= 0.5; log += 0.1) {
      const moonlight = BRIGHT_MOONLIGHT * 10 ** log;
      const shown = skyExposure(-30, moonlight) * moonlight;
      expect(shown).toBeGreaterThan(prev);
      prev = shown;
    }
  });

  it('changes smoothly as moonlight fades to nothing', () => {
    let prev = moonExposureBoost(BRIGHT_MOONLIGHT * 1e-4);
    for (let log = -4; log <= 0.5; log += 0.01) {
      const boost = moonExposureBoost(BRIGHT_MOONLIGHT * 10 ** log);
      expect(Math.abs(boost - prev)).toBeLessThan(0.1);
      prev = boost;
    }
  });
});

describe('starExposure', () => {
  it('follows the sky through twilight but caps at the night level', () => {
    expect(starExposure(10)).toBe(10);
    expect(starExposure(NIGHT_EXPOSURE * 50)).toBe(NIGHT_EXPOSURE);
  });
});
