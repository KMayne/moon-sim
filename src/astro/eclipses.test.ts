import { describe, expect, it } from 'vitest';
import { MS_PER_DAY } from './constants';
import { EclipseCache, eclipseInProgress, lunarStageAt } from './eclipses';

const TROMSO = { latitude: 69.65, longitude: 18.96 };
const REYKJAVIK = { latitude: 64.1466, longitude: -21.9426 };
const MAUNA_KEA = { latitude: 19.82, longitude: -155.47 };
const MIN = 60_000;

describe('lunar eclipses', () => {
  it('finds the 2026-03-03 total eclipse after New Year 2026', () => {
    const e = new EclipseCache().lunar(MAUNA_KEA, Date.UTC(2026, 0, 1));
    expect(e.kind).toBe('total');
    expect(Math.abs(e.peakMs - Date.UTC(2026, 2, 3, 11, 33))).toBeLessThan(5 * MIN);
    expect(e.startMs).toBeLessThan(e.partialStartMs ?? 0);
    expect(e.totalStartMs).toBeLessThan(e.peakMs);
    expect(e.endMs).toBeGreaterThan(e.totalEndMs ?? Infinity);
    // Peak ~01:33 local in Hawaii: Moon well up.
    expect(e.visibility).toBe('visible');
  });

  it('finds the 2026-08-28 partial eclipse after April 2026', () => {
    const e = new EclipseCache().lunar(TROMSO, Date.UTC(2026, 3, 1));
    expect(e.kind).toBe('partial');
    expect(new Date(e.peakMs).toISOString().slice(0, 10)).toBe('2026-08-28');
    expect(e.totalStartMs).toBeUndefined();
  });

  it('still reports an eclipse while it is in progress, with its stage', () => {
    const cache = new EclipseCache();
    const atPeak = Date.UTC(2026, 2, 3, 11, 33);
    const e = cache.lunar(MAUNA_KEA, atPeak);
    expect(Math.abs(e.peakMs - atPeak)).toBeLessThan(5 * MIN);
    expect(lunarStageAt(e, atPeak)).toBe('total');
    expect(lunarStageAt(e, (e.partialStartMs ?? 0) + MIN)).toBe('partial');
    expect(lunarStageAt(e, e.startMs + MIN)).toBe('penumbral');
    expect(lunarStageAt(e, e.endMs + MIN)).toBeNull();
    expect(eclipseInProgress(e, null, MAUNA_KEA, atPeak)).toMatchObject({
      body: 'moon',
      stage: 'total',
    });
  });

  it('is not "in progress" for an observer whose Moon is below the horizon', () => {
    const atPeak = Date.UTC(2026, 2, 3, 11, 33);
    const e = new EclipseCache().lunar(TROMSO, atPeak);
    // ~12:33 local in Tromsø in March: Moon (opposite the Sun) is below the horizon.
    expect(e.visibility).not.toBe('visible');
    expect(eclipseInProgress(e, null, TROMSO, atPeak)).toBeNull();
  });
});

describe('solar eclipses', () => {
  it('finds the 2026-08-12 total eclipse with greatest eclipse near Iceland', () => {
    const g = new EclipseCache().globalSolar(Date.UTC(2026, 5, 1));
    expect(g.kind).toBe('total');
    expect(Math.abs(g.peakMs - Date.UTC(2026, 7, 12, 17, 46))).toBeLessThan(10 * MIN);
    expect(g.latitude).toBeGreaterThan(55);
    expect(g.latitude).toBeLessThan(75);
    expect(g.longitude).toBeGreaterThan(-40);
    expect(g.longitude).toBeLessThan(0);
  });

  it('sees it as total from Reykjavík and partial from Tromsø', () => {
    const from = Date.UTC(2026, 5, 1);
    const reykjavik = new EclipseCache().localSolar(REYKJAVIK, from);
    expect(reykjavik?.kind).toBe('total');
    expect(new Date(reykjavik?.peakMs ?? 0).toISOString().slice(0, 10)).toBe('2026-08-12');
    expect(reykjavik?.obscuration).toBe(1);

    const tromso = new EclipseCache().localSolar(TROMSO, from);
    expect(tromso?.kind).toBe('partial');
    expect(new Date(tromso?.peakMs ?? 0).toISOString().slice(0, 10)).toBe('2026-08-12');
    expect(tromso?.obscuration).toBeGreaterThan(0.3);
    expect(tromso?.obscuration).toBeLessThan(1);
  });

  it('only reports local solar eclipses with the Sun up', () => {
    const e = new EclipseCache().localSolar(MAUNA_KEA, Date.UTC(2026, 0, 1));
    expect(e).not.toBeNull();
    // Some contact (start, peak or end) above the horizon; usually the peak.
    expect(e?.peakSunAltitudeDeg).toBeGreaterThan(-20);
    expect(e?.peakMs).toBeGreaterThan(Date.UTC(2026, 0, 1));
  });
});

describe('EclipseCache', () => {
  it('searches once per event, not per poll, forwards and in reverse', () => {
    const cache = new EclipseCache();
    const start = Date.UTC(2026, 0, 1);
    for (let t = start; t < start + 30 * MS_PER_DAY; t += 6 * 3_600_000) {
      cache.lunar(TROMSO, t);
      cache.globalSolar(t);
      cache.localSolar(TROMSO, t);
    }
    expect(cache.searches).toBe(3);
    // Stepping backwards inside the cached range doesn't search again.
    cache.lunar(TROMSO, start + MS_PER_DAY);
    expect(cache.searches).toBe(3);
  });

  it('re-searches when the location changes (not for global eclipses)', () => {
    const cache = new EclipseCache();
    const t = Date.UTC(2026, 0, 1);
    cache.lunar(TROMSO, t);
    cache.globalSolar(t);
    cache.lunar(MAUNA_KEA, t);
    cache.globalSolar(t);
    expect(cache.searches).toBe(3);
  });

  it('agrees with a fresh search everywhere, including just after an eclipse ends', () => {
    const cache = new EclipseCache();
    const first = new EclipseCache().lunar(TROMSO, Date.UTC(2026, 0, 1));
    for (const t of [first.startMs - MIN, first.peakMs, first.endMs - MIN, first.endMs + MIN]) {
      expect(cache.lunar(TROMSO, t).peakMs).toBe(new EclipseCache().lunar(TROMSO, t).peakMs);
    }
  });

  it('keeps the average cost per HUD poll low at 30 days/s', () => {
    const cache = new EclipseCache();
    const pollStepMs = (30 * MS_PER_DAY) / 4; // 4 Hz HUD polling at 30 days/s
    const polls = 800; // ~16 years of sim time
    const start = Date.UTC(2026, 0, 1);
    const t0 = performance.now();
    for (let i = 0; i < polls; i++) {
      const t = start + i * pollStepMs;
      const lunar = cache.lunar(TROMSO, t);
      const solar = cache.localSolar(TROMSO, t);
      cache.globalSolar(t);
      eclipseInProgress(lunar, solar, TROMSO, t);
    }
    const perPollMs = (performance.now() - t0) / polls;
    // Measured ~0.36 ms (individual re-searches take up to ~20 ms, once per event).
    expect(perPollMs).toBeLessThan(2);
  });
});
