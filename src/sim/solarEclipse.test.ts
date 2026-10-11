import {
  EclipseKind,
  Observer,
  SearchGlobalSolarEclipse,
  SearchLocalSolarEclipse,
} from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { computeSystemState } from '../astro/ephemeris';
import { observerEcefKm } from '../astro/observer';
import { mulVec } from '../astro/vec';
import {
  coronaFlux,
  coronaWeight,
  eclipseSunlightScale,
  observerSolarFraction,
  solarFractionAt,
  TOTALITY_SKY_RESIDUAL,
  totalityResidual,
} from './solarEclipse';

const AUG_2026 = new Date(Date.UTC(2026, 6, 1));
const REYKJAVIK = { latitude: 64.1466, longitude: -21.9426 };
const TROMSO = { latitude: 69.65, longitude: 18.96 };

function localPeak(site: { latitude: number; longitude: number }, from: Date) {
  const e = SearchLocalSolarEclipse(from, new Observer(site.latitude, site.longitude, 0));
  return { ms: e.peak.time.date.getTime(), kind: e.kind, obscuration: e.obscuration };
}

describe('solar eclipse from the observer', () => {
  it('Reykjavík sees totality on 2026-08-12 (Sun fully covered at local peak)', () => {
    const peak = localPeak(REYKJAVIK, AUG_2026);
    expect(peak.kind).toBe(EclipseKind.Total);
    const f = observerSolarFraction(computeSystemState(new Date(peak.ms)), REYKJAVIK);
    expect(f).toBeLessThan(1e-3);
  });

  it("Tromsø's partial eclipse matches astronomy-engine's obscuration within 1%", () => {
    const peak = localPeak(TROMSO, AUG_2026);
    expect(peak.kind).toBe(EclipseKind.Partial);
    const f = observerSolarFraction(computeSystemState(new Date(peak.ms)), TROMSO);
    expect(1 - f).toBeCloseTo(peak.obscuration, 2);
  });

  it('leaves a ring at an annular eclipse (2027-02-06 near greatest eclipse)', () => {
    const g = SearchGlobalSolarEclipse(new Date(Date.UTC(2027, 0, 1)));
    expect(g.kind).toBe(EclipseKind.Annular);
    const site = { latitude: g.latitude ?? 0, longitude: g.longitude ?? 0 };
    const f = observerSolarFraction(computeSystemState(g.peak.date), site);
    expect(f).toBeGreaterThan(0.02);
    expect(f).toBeLessThan(0.2);
  });

  it('is 1 when there is no eclipse', () => {
    expect(
      observerSolarFraction(computeSystemState(new Date(Date.UTC(2026, 9, 11, 12))), TROMSO),
    ).toBe(1);
  });
});

describe("the Moon's shadow on Earth", () => {
  it('centres the umbra on astronomy-engine’s point of greatest eclipse (2026-08-12)', () => {
    const g = SearchGlobalSolarEclipse(AUG_2026);
    expect(g.kind).toBe(EclipseKind.Total);
    const state = computeSystemState(g.peak.date);
    const at = (latitude: number, longitude: number) =>
      solarFractionAt(
        state,
        mulVec(state.earthOrientation, observerEcefKm({ latitude, longitude })),
      );
    const lat = g.latitude ?? 0;
    const lon = g.longitude ?? 0;
    expect(at(lat, lon)).toBeLessThan(1e-3);
    // ~1° of latitude is ~111 km: still inside a ~290 km-wide path; 20° away is outside the umbra
    // but inside the ~7,000 km penumbra.
    expect(at(lat + 0.5, lon)).toBeLessThan(0.05);
    const far = at(lat - 20, lon);
    expect(far).toBeGreaterThan(0.05);
    expect(far).toBeLessThan(1);
    expect(at(-lat, lon + 180)).toBe(1);
  });
});

describe('sky light and corona during an eclipse', () => {
  it('scales sunlight by the visible fraction with a small totality residual', () => {
    expect(eclipseSunlightScale(1)).toBe(1);
    expect(eclipseSunlightScale(0.5)).toBeCloseTo(0.5, 3);
    expect(eclipseSunlightScale(0)).toBe(TOTALITY_SKY_RESIDUAL);
    expect(totalityResidual(1)).toBe(0);
    expect(totalityResidual(0)).toBe(TOTALITY_SKY_RESIDUAL);
  });

  it('gives the corona about a full Moon of light (~1e-6 of the Sun)', () => {
    expect(coronaFlux()).toBeGreaterThan(5e-7);
    expect(coronaFlux()).toBeLessThan(2e-6);
  });

  it('shows the corona only near totality', () => {
    expect(coronaWeight(1)).toBe(0);
    expect(coronaWeight(0.01)).toBe(0);
    expect(coronaWeight(1e-4)).toBeGreaterThan(0);
    expect(coronaWeight(0)).toBe(1);
  });
});
