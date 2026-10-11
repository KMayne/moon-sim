import { SearchMoonPhase } from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import {
  airmass,
  atmosphericTransmittance,
  BRIGHT_MOONLIGHT,
  lunarToSolarRatio,
  magnitudeRatio,
  moonlightOnGround,
  moonSkyLightScale,
  sunSkyLightScale,
} from './moonlight';

const DAY_MS = 86_400_000;

/** The instant of a given lunar phase (0 new, 90 first quarter, 180 full) after 2026-01-01. */
function phaseInstant(targetLon: number): Date {
  const t = SearchMoonPhase(targetLon, new Date(Date.UTC(2026, 0, 1)), 40);
  if (!t) throw new Error('phase not found');
  return t.date;
}

describe('lunarToSolarRatio', () => {
  it('is ~2–3e-6 at full Moon (m ≈ −12.7 vs −26.7)', () => {
    const r = lunarToSolarRatio(phaseInstant(180));
    expect(r).toBeGreaterThan(2e-6);
    expect(r).toBeLessThan(3e-6);
  });

  it('falls from full to quarter to crescent', () => {
    const full = lunarToSolarRatio(phaseInstant(180));
    const quarter = lunarToSolarRatio(phaseInstant(90));
    const newMoon = phaseInstant(0);
    const crescent = lunarToSolarRatio(new Date(newMoon.getTime() + 3 * DAY_MS));
    expect(full).toBeGreaterThan(quarter);
    expect(quarter).toBeGreaterThan(crescent);
    // Opposition surge and the phase law make a quarter Moon ~1/10 of full, not 1/2.
    expect(quarter / full).toBeGreaterThan(0.05);
    expect(quarter / full).toBeLessThan(0.2);
  });

  it('is cached within a sim-minute but follows time beyond it', () => {
    const t = Math.floor(phaseInstant(90).getTime() / 60_000) * 60_000;
    const a = lunarToSolarRatio(new Date(t));
    expect(lunarToSolarRatio(new Date(t + 10_000))).toBe(a);
    expect(lunarToSolarRatio(new Date(t + 6 * 3_600_000))).not.toBe(a);
  });
});

describe('magnitudeRatio', () => {
  it('is 100× per 5 magnitudes', () => {
    expect(magnitudeRatio(-5, 0)).toBeCloseTo(100, 9);
  });
});

describe('atmosphere', () => {
  it('has airmass 1 overhead and ~38 at the horizon', () => {
    expect(airmass(90)).toBeCloseTo(1, 3);
    expect(airmass(0)).toBeGreaterThan(35);
    expect(airmass(0)).toBeLessThan(40);
  });

  it('transmits most light overhead, little near the horizon, none below it', () => {
    expect(atmosphericTransmittance(90)).toBeGreaterThan(0.8);
    expect(atmosphericTransmittance(2)).toBeLessThan(0.1);
    expect(atmosphericTransmittance(-1)).toBe(0);
  });
});

describe('moonlightOnGround', () => {
  it('is zero with the Moon below the horizon', () => {
    expect(moonlightOnGround(2.4e-6, -0.5)).toBe(0);
    expect(moonlightOnGround(2.4e-6, -30)).toBe(0);
  });

  it('rises with Moon altitude', () => {
    let prev = 0;
    for (let alt = 1; alt <= 90; alt += 1) {
      const e = moonlightOnGround(2.4e-6, alt);
      expect(e).toBeGreaterThan(prev);
      prev = e;
    }
  });

  it('defines bright moonlight as a full Moon 60° up', () => {
    expect(BRIGHT_MOONLIGHT).toBeCloseTo(moonlightOnGround(2.4e-6, 60), 15);
    expect(BRIGHT_MOONLIGHT).toBeGreaterThan(1e-6);
  });
});

describe('shader light scales', () => {
  it('lights the night sky by the Moon only when it can matter', () => {
    expect(moonSkyLightScale(2.4e-6, 40, -30)).toBeCloseTo(2.4e-6, 12);
    expect(moonSkyLightScale(2.4e-6, -10, -30)).toBe(0);
    expect(moonSkyLightScale(2.4e-6, 40, 10)).toBe(0);
  });

  it('fades the Sun’s scattering out by the end of astronomical twilight', () => {
    expect(sunSkyLightScale(10)).toBe(1);
    expect(sunSkyLightScale(-12)).toBe(1);
    expect(sunSkyLightScale(-18)).toBe(0);
    expect(sunSkyLightScale(-30)).toBe(0);
  });
});
