import { SearchLunarEclipse } from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { MOON_RADIUS_KM, SUN_RADIUS_KM } from '../astro/constants';
import { computeSystemState } from '../astro/ephemeris';
import { add, length, normalize, scale, vec } from '../astro/vec';
import {
  discCoveredFraction,
  EARTH_SHADOW_RADIUS_KM,
  eclipseDisplayGain,
  eclipseGeometry,
  lunarEclipseDimming,
  lunarEclipseIllumination,
  lunarEclipseLightAt,
  lunarEclipseState,
  NO_ECLIPSE,
  visibleSolarFraction,
  type LunarEclipseKind,
} from './eclipse';
import { ECLIPSE_GLSL } from './eclipseGlsl';
import { toSkyScene } from './skyScene';
import { UMBRAL_TABLE } from './umbralLight.table';

const MIN = 60_000;
const at = (ms: number) => computeSystemState(new Date(ms));
const kindAt = (ms: number): LunarEclipseKind => lunarEclipseState(at(ms)).kind;
const luminance = ([r, g, b]: readonly number[]) =>
  0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);

describe('discCoveredFraction', () => {
  it('handles disjoint, contained, annular and partial overlaps', () => {
    expect(discCoveredFraction(1, 1, 3)).toBe(0);
    expect(discCoveredFraction(1, 3, 1)).toBe(1);
    expect(discCoveredFraction(1, 0.5, 0.2)).toBeCloseTo(0.25, 12);
    // Two equal discs half a radius... at d = r the lens covers ~39.1%.
    expect(discCoveredFraction(1, 1, 1)).toBeCloseTo(0.391, 3);
  });

  it('grows monotonically as the occluder slides over the disc', () => {
    let prev = -1;
    for (let d = 2; d >= 0; d -= 0.05) {
      const f = discCoveredFraction(1, 0.8, d);
      expect(f).toBeGreaterThanOrEqual(prev);
      prev = f;
    }
  });
});

describe('ECLIPSE_GLSL', () => {
  it('embeds the same constants and lookup as the TypeScript model', () => {
    expect(ECLIPSE_GLSL).toContain(`MOON_SIM_EARTH_SHADOW_RADIUS_KM = ${EARTH_SHADOW_RADIUS_KM}.0`);
    expect(ECLIPSE_GLSL).toContain(`MOON_SIM_SUN_RADIUS_KM = ${SUN_RADIUS_KM}.0`);
    expect(ECLIPSE_GLSL.match(/vec3\(/g)?.length).toBeGreaterThanOrEqual(UMBRAL_TABLE.length);
    const first = UMBRAL_TABLE[0];
    if (!first) throw new Error('empty table');
    expect(ECLIPSE_GLSL).toContain(`vec3(${first.map(String).join(', ')})`);
  });
});

describe('Earth shadow vs astronomy-engine eclipse predictions', () => {
  const cases = [
    { start: Date.UTC(2025, 2, 1), kind: 'total' },
    { start: Date.UTC(2026, 1, 20), kind: 'total' },
    { start: Date.UTC(2026, 7, 20), kind: 'partial' },
  ] as const;

  for (const { start, kind } of cases) {
    const e = SearchLunarEclipse(new Date(start));
    const peak = e.peak.date.getTime();
    const label = `${kind} eclipse of ${e.peak.date.toISOString().slice(0, 10)}`;

    it(`${label}: same kind, deepest at astronomy-engine's peak`, () => {
      expect(e.kind).toBe(kind);
      expect(kindAt(peak)).toBe(kind);
      const r = (ms: number) => lunarEclipseState(at(ms)).r;
      expect(r(peak)).toBeLessThanOrEqual(r(peak - 3 * MIN));
      expect(r(peak)).toBeLessThanOrEqual(r(peak + 3 * MIN));
    });

    it(`${label}: contacts within 1–2 minutes`, () => {
      const phases: [number, LunarEclipseKind, LunarEclipseKind][] = [
        [e.sd_penum, 'penumbral', 'none'],
        [e.sd_partial, 'partial', 'penumbral'],
        [e.sd_total, 'total', 'partial'],
      ];
      for (const [semiDuration, inside, outside] of phases) {
        if (semiDuration <= 0) continue;
        for (const sign of [-1, 1]) {
          expect(kindAt(peak + sign * (semiDuration - 1.5) * MIN)).toBe(inside);
          expect(kindAt(peak + sign * (semiDuration + 1.5) * MIN)).toBe(outside);
        }
      }
    });
  }
});

describe('light near Earth during a lunar eclipse', () => {
  const peak = SearchLunarEclipse(new Date(Date.UTC(2026, 1, 20))).peak.date.getTime();
  const state = at(peak);
  const sun = { center: state.sun, radius: SUN_RADIUS_KM };
  const earth = { center: vec(0, 0, 0), radius: EARTH_SHADOW_RADIUS_KM };
  const antiSun = normalize(scale(state.sun, -1));
  const side = normalize({ x: -antiSun.y, y: antiSun.x, z: 0 });
  const onAxis = scale(antiSun, 384_400);
  const across = (km: number) => add(onAxis, scale(side, km));

  it('direct sunlight: none deep in the umbra, full far outside, monotonic in between', () => {
    expect(visibleSolarFraction(across(0), sun, earth)).toBe(0);
    expect(visibleSolarFraction(across(20_000), sun, earth)).toBe(1);
    let prev = -1;
    for (let km = 0; km <= 14_000; km += 250) {
      const f = visibleSolarFraction(across(km), sun, earth);
      expect(f).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = f;
    }
  });

  it('the umbra glows dim and red with refracted sunlight, brighter toward its edge', () => {
    const centre = lunarEclipseLightAt(across(0), state.sun);
    const nearEdge = lunarEclipseLightAt(across(4_000), state.sun);
    expect(luminance(centre)).toBeGreaterThan(1e-5);
    expect(luminance(centre)).toBeLessThan(1e-3);
    expect(centre[0] / centre[1]).toBeGreaterThan(3);
    expect(luminance(nearEdge)).toBeGreaterThan(luminance(centre));
  });

  it('dims the Moon by ~10 magnitudes at mid-totality, not at all outside eclipses', () => {
    const dimming = lunarEclipseDimming(state);
    expect(dimming).toBeLessThan(1e-3);
    expect(dimming).toBeGreaterThan(1e-6);
    // A full Moon without an eclipse (2026-10-26).
    expect(lunarEclipseDimming(at(Date.UTC(2026, 9, 26, 4, 12)))).toBe(1);
  });

  it('dims the sky view’s moonlight at totality', () => {
    const tromso = { latitude: 69.65, longitude: 18.96 };
    const sky = toSkyScene(state, tromso, { bodySize: 1 });
    expect(sky.eclipseIllumination.mean).toBeLessThan(1e-3);
    expect(sky.lunarToSolar).toBeLessThan(2.4e-6 * 1e-3);
  });

  it('gives each view the true geometry, only rotated', () => {
    const sky = toSkyScene(state, { latitude: 19.82, longitude: -155.47 }, { bodySize: 1 });
    const g = eclipseGeometry(state, sky.eqjToSky);
    expect(length(g.moonCenterKm)).toBeCloseTo(length(state.moon), 6);
    expect(length(g.sunKm)).toBeCloseTo(length(state.sun), 0);
  });

  it('auto-exposes an eclipsed Moon, and leaves an uneclipsed one alone', () => {
    const totality = lunarEclipseIllumination(state);
    expect(eclipseDisplayGain(totality) * totality.max).toBeCloseTo(1, 6);
    expect(eclipseDisplayGain(NO_ECLIPSE)).toBe(1);
    expect(eclipseDisplayGain(totality, 0.75)).toBeLessThan(eclipseDisplayGain(totality));
  });

  it('classifies the mid-totality Moon at the right depth', () => {
    const s = lunarEclipseState(state);
    expect(s.kind).toBe('total');
    expect(s.umbralMagnitude).toBeGreaterThan(1);
    expect(s.r + MOON_RADIUS_KM).toBeLessThan(s.umbra);
  });
});
