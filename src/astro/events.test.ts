import { SearchMoonPhase } from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { MS_PER_DAY } from './constants';
import {
  MoonAgeCache,
  moonPhaseInfo,
  phaseNameFor,
  RISE_SET_WINDOW_DAYS,
  RiseSetCache,
  type HorizonEvent,
} from './events';

const TROMSO = { latitude: 69.65, longitude: 18.96 };
const MAUNA_KEA = { latitude: 19.82, longitude: -155.47 };
const HOUR_MS = 3_600_000;

function phaseInstant(targetLon: number, from: Date): number {
  const t = SearchMoonPhase(targetLon, from, 40);
  if (!t) throw new Error('phase not found');
  return t.date.getTime();
}

const timeOf = (e: HorizonEvent): number => {
  if (!e.found) throw new Error(`expected an event, got ${e.reason}`);
  return e.timeMs;
};

describe('phaseNameFor', () => {
  it('bins into 45° sectors centred on the principal phases', () => {
    expect(phaseNameFor(0)).toBe('New Moon');
    expect(phaseNameFor(359)).toBe('New Moon');
    expect(phaseNameFor(22.4)).toBe('New Moon');
    expect(phaseNameFor(22.5)).toBe('Waxing Crescent');
    expect(phaseNameFor(90)).toBe('First Quarter');
    expect(phaseNameFor(135)).toBe('Waxing Gibbous');
    expect(phaseNameFor(180)).toBe('Full Moon');
    expect(phaseNameFor(225)).toBe('Waning Gibbous');
    expect(phaseNameFor(270)).toBe('Last Quarter');
    expect(phaseNameFor(337.4)).toBe('Waning Crescent');
    expect(phaseNameFor(337.5)).toBe('New Moon');
  });
});

describe('moonPhaseInfo at 2026 events', () => {
  const start = new Date(Date.UTC(2026, 0, 1));
  const full = phaseInstant(180, start);
  const fresh = phaseInstant(0, start);

  it('full moon: ~100% lit, named, S–E–M ≈ 180°', () => {
    const info = moonPhaseInfo(new Date(full));
    expect(info.phaseName).toBe('Full Moon');
    expect(info.illuminatedFraction).toBeGreaterThan(0.99);
    // Off 180° by at most the Moon's ecliptic latitude (~5.1°).
    expect(info.sunEarthMoonDeg).toBeGreaterThan(174);
  });

  it('new moon: ~0% lit, named, S–E–M ≈ 0°', () => {
    const info = moonPhaseInfo(new Date(fresh));
    expect(info.phaseName).toBe('New Moon');
    expect(info.illuminatedFraction).toBeLessThan(0.01);
    expect(info.sunEarthMoonDeg).toBeLessThan(6);
  });

  it('age is ~14.8 days at full moon and ~0 just after new moon', () => {
    const cache = new MoonAgeCache();
    const fullAfterNew = phaseInstant(180, new Date(fresh));
    expect(cache.ageDays(fullAfterNew)).toBeGreaterThan(13.5);
    expect(cache.ageDays(fullAfterNew)).toBeLessThan(16);
    expect(cache.ageDays(fresh + HOUR_MS)).toBeCloseTo(1 / 24, 3);
  });
});

describe('MoonAgeCache', () => {
  it('searches only when sim time leaves the cached lunation', () => {
    const cache = new MoonAgeCache();
    const fresh = phaseInstant(0, new Date(Date.UTC(2026, 2, 1)));
    for (let t = fresh + HOUR_MS; t < fresh + 20 * MS_PER_DAY; t += HOUR_MS) cache.ageDays(t);
    expect(cache.searches).toBe(2);
    cache.ageDays(fresh + 40 * MS_PER_DAY);
    expect(cache.searches).toBe(4);
  });

  it('works running backwards across a new moon', () => {
    const cache = new MoonAgeCache();
    const fresh = phaseInstant(0, new Date(Date.UTC(2026, 2, 1)));
    expect(cache.ageDays(fresh + HOUR_MS)).toBeCloseTo(1 / 24, 3);
    expect(cache.ageDays(fresh - HOUR_MS)).toBeGreaterThan(29);
  });
});

describe('RiseSetCache', () => {
  it('Mauna Kea: next rise and set are within the window, rise/set alternate', () => {
    const cache = new RiseSetCache();
    const t = Date.UTC(2026, 3, 10);
    const { rise, set } = cache.next(MAUNA_KEA, t);
    const r = timeOf(rise);
    const s = timeOf(set);
    expect(r).toBeGreaterThanOrEqual(t);
    expect(s).toBeGreaterThanOrEqual(t);
    expect(Math.abs(r - s)).toBeLessThan(RISE_SET_WINDOW_DAYS * MS_PER_DAY);
    // The following rise comes ~24.8 h after this one.
    const later = cache.next(MAUNA_KEA, r + 1);
    expect((timeOf(later.rise) - r) / HOUR_MS).toBeGreaterThan(24);
    expect((timeOf(later.rise) - r) / HOUR_MS).toBeLessThan(26);
  });

  it('Tromsø: gives a reason when the Moon neither rises nor sets in the window', () => {
    // Find, in 2026, a time when the Moon stays up (or down) for the whole window at Tromsø.
    const cache = new RiseSetCache(1024);
    const reasons = new Set<string>();
    for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2026, 2, 1); t += 6 * HOUR_MS) {
      const { rise, set } = cache.next(TROMSO, t);
      if (!rise.found && !set.found) {
        expect(rise.reason).toBe(set.reason);
        reasons.add(rise.reason);
      }
    }
    expect(reasons).toContain('circumpolar');
    expect(reasons).toContain('never-rises');
  });

  it('computes each (location, day) once and invalidates by location', () => {
    const cache = new RiseSetCache();
    const t = Date.UTC(2026, 3, 10, 5);
    for (let i = 0; i < 20; i++) cache.next(MAUNA_KEA, t + i * 60_000);
    // Window [t, t+2d) touches three UTC days.
    expect(cache.dayComputations).toBe(3);
    cache.next(TROMSO, t);
    expect(cache.dayComputations).toBe(6);
  });

  it('stays cheap per poll at 30 days/s (4 Hz polling)', () => {
    const cache = new RiseSetCache();
    const ages = new MoonAgeCache();
    const step = (30 * MS_PER_DAY) / 4;
    const polls = 40;
    const start = performance.now();
    for (let i = 0; i < polls; i++) {
      const t = Date.UTC(2026, 0, 1) + i * step;
      cache.next(TROMSO, t);
      ages.ageDays(t);
      moonPhaseInfo(new Date(t));
    }
    const perPollMs = (performance.now() - start) / polls;
    expect(perPollMs).toBeLessThan(10);
  });
});
