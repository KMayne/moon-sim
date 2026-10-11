import { SearchMoonPhase } from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import {
  MEAN_SYNODIC_MONTH_DAYS,
  MS_PER_DAY,
  SIDEREAL_ROTATIONS_PER_SOLAR_DAY,
} from '../astro/constants';
import { computeSystemState } from '../astro/ephemeris';
import { ECLIPTIC_POLE_EQJ } from '../astro/frames';
import {
  add,
  angleBetweenDeg,
  column,
  cross,
  dot,
  mulVec,
  normalize,
  scale,
  sub,
  vec,
  type Vec3,
} from '../astro/vec';
import { toOrbitScene, type OrbitScene } from './orbitScene';

const HOUR_MS = 3_600_000;
const sceneAt = (ms: number): OrbitScene => toOrbitScene(computeSystemState(new Date(ms)));

/** Body-local axes in scene space (see axes.ts for the local convention). */
const earthAxes = (s: OrbitScene) => ({
  primeMeridian: column(s.earth.rotation, 0),
  pole: column(s.earth.rotation, 1),
  east: scale(column(s.earth.rotation, 2), -1),
});

/** Longitude (deg) at which `dir` crosses Earth's equator plane, in Earth's body frame. */
function earthLongitudeOf(s: OrbitScene, dir: Vec3): number {
  const { primeMeridian, pole, east } = earthAxes(s);
  const inEquator = sub(dir, scale(pole, dot(dir, pole)));
  return (Math.atan2(dot(inEquator, east), dot(inEquator, primeMeridian)) * 180) / Math.PI;
}

/** Sum of wrapped angle steps: total signed rotation in degrees. */
function unwrappedTotal(samples: readonly number[]): number {
  let total = 0;
  for (let i = 1; i < samples.length; i++) {
    let step = (samples[i] ?? 0) - (samples[i - 1] ?? 0);
    step -= 360 * Math.round(step / 360);
    total += step;
  }
  return total;
}

function sampleTimes(startMs: number, endMs: number, stepMs: number): number[] {
  const n = Math.ceil((endMs - startMs) / stepMs);
  return Array.from({ length: n + 1 }, (_, i) => Math.min(endMs, startMs + i * stepMs));
}

/** Consecutive new moons from `from`, as ms timestamps. */
function newMoons(from: Date, count: number): number[] {
  const out: number[] = [];
  let t = SearchMoonPhase(0, from, 40);
  for (let i = 0; i < count && t; i++) {
    out.push(t.date.getTime());
    t = SearchMoonPhase(0, new Date(t.date.getTime() + MS_PER_DAY), 40);
  }
  return out;
}

interface LunationCounts {
  days: number;
  /** Earth rotations relative to the Sun direction. */
  solar: number;
  /** Earth rotations relative to the stars. */
  sidereal: number;
  /** Earth rotations relative to the Moon direction. */
  lunar: number;
  /** Moon revolutions around Earth in the Sun-fixed scene. */
  moonRevolutions: number;
}

function countLunation(startMs: number, endMs: number): LunationCounts {
  const sunLon: number[] = [];
  const starLon: number[] = [];
  const moonLon: number[] = [];
  const moonAngle: number[] = [];
  for (const t of sampleTimes(startMs, endMs, HOUR_MS)) {
    const s = sceneAt(t);
    sunLon.push(earthLongitudeOf(s, s.sunDirection));
    // A fixed inertial direction (J2000 equinox), carried into the Sun-fixed scene.
    starLon.push(earthLongitudeOf(s, mulVec(s.eqjToScene, vec(1, 0, 0))));
    moonLon.push(earthLongitudeOf(s, normalize(s.moon.position)));
    // Scene is Y-up: ecliptic plane is xz. Counter-clockwise seen from ecliptic north.
    moonAngle.push((Math.atan2(-s.moon.position.z, s.moon.position.x) * 180) / Math.PI);
  }
  // Earth spins eastward, so fixed directions drift westward in Earth's frame: negate.
  return {
    days: (endMs - startMs) / MS_PER_DAY,
    solar: -unwrappedTotal(sunLon) / 360,
    sidereal: -unwrappedTotal(starLon) / 360,
    lunar: -unwrappedTotal(moonLon) / 360,
    moonRevolutions: unwrappedTotal(moonAngle) / 360,
  };
}

describe('acceptance: Earth spin vs synodic month (as rendered)', () => {
  const moons = newMoons(new Date(Date.UTC(2026, 0, 1)), 13);
  const lunations = moons.slice(1).map((end, i) => countLunation(moons[i] ?? 0, end));

  it('finds 12 lunations', () => {
    expect(lunations).toHaveLength(12);
  });

  it('Moon makes exactly one revolution per lunation in the Sun-fixed frame', () => {
    for (const l of lunations) expect(l.moonRevolutions).toBeCloseTo(1, 3);
  });

  it('Earth turns once per solar day relative to the Sun', () => {
    // Exact to within the equation of time's drift over one month (< 15 min).
    for (const l of lunations) expect(Math.abs(l.solar - l.days)).toBeLessThan(0.01);
  });

  it('Earth turns ~29.53× per synodic month relative to the Sun (mean over a year)', () => {
    const mean = lunations.reduce((sum, l) => sum + l.solar, 0) / lunations.length;
    expect(mean).toBeGreaterThan(MEAN_SYNODIC_MONTH_DAYS - 0.1);
    expect(mean).toBeLessThan(MEAN_SYNODIC_MONTH_DAYS + 0.1);
  });

  it('Earth turns ~29.61× per synodic month relative to the stars', () => {
    for (const l of lunations) {
      expect(l.sidereal).toBeCloseTo(l.days * SIDEREAL_ROTATIONS_PER_SOLAR_DAY, 2);
    }
  });

  it('rotations relative to Sun and Moon differ by exactly one (the Moon laps once)', () => {
    for (const l of lunations) expect(l.solar - l.lunar).toBeCloseTo(1, 2);
  });
});

describe('acceptance: tidal locking (as rendered)', () => {
  const start = Date.UTC(2026, 0, 1);
  const angles = sampleTimes(start, start + 365.25 * MS_PER_DAY, HOUR_MS).map((t) => {
    const s = sceneAt(t);
    const nearSide = column(s.moon.rotation, 0);
    const towardEarth = sub(s.earth.position, s.moon.position);
    return angleBetweenDeg(nearSide, towardEarth);
  });

  it('near-side marker never turns more than libration allows from Earth', () => {
    // Combined optical + physical libration. Measured max over 1900–2100 (3-hourly): 10.47°.
    expect(Math.max(...angles)).toBeLessThan(11);
  });

  it('libration is real, not scripted: the marker wobbles by several degrees', () => {
    expect(Math.max(...angles)).toBeGreaterThan(5);
  });
});

describe('orbit scene geometry', () => {
  const t = Date.UTC(2026, 2, 20, 12);
  const s = sceneAt(t);

  it('keeps the Sun fixed on +x', () => {
    expect(s.sunDirection.x).toBeCloseTo(1, 9);
  });

  it("tilts Earth's axis 23.44° from ecliptic north (+y)", () => {
    expect(angleBetweenDeg(earthAxes(s).pole, vec(0, 1, 0))).toBeCloseTo(23.44, 1);
  });

  it('puts Greenwich under the Sun near 12:00 UTC (within the equation of time)', () => {
    expect(Math.abs(earthLongitudeOf(s, s.sunDirection))).toBeLessThan(5);
    const midnight = sceneAt(Date.UTC(2026, 2, 20, 0));
    expect(Math.abs(earthLongitudeOf(midnight, midnight.sunDirection))).toBeGreaterThan(175);
  });

  it("inclines the Moon's mean orbit plane ~5.1° to the ecliptic", () => {
    // Fit the plane over one month in the inertial frame (the Sun-fixed frame turns ~27° meanwhile).
    const positions = sampleTimes(t, t + 27.3 * MS_PER_DAY, 6 * HOUR_MS).map(
      (ms) => computeSystemState(new Date(ms)).moon,
    );
    let normal = vec(0, 0, 0);
    for (let i = 1; i < positions.length; i++) {
      const a = positions[i - 1];
      const b = positions[i];
      if (a && b) normal = add(normal, normalize(cross(a, b)));
    }
    const inclination = angleBetweenDeg(normal, ECLIPTIC_POLE_EQJ);
    expect(inclination).toBeGreaterThan(4.9);
    expect(inclination).toBeLessThan(5.4);
  });

  it('places the Moon at ~60 Earth radii and sizes it at 0.27 Earth radii', () => {
    const r = Math.hypot(s.moon.position.x, s.moon.position.y, s.moon.position.z);
    expect(r).toBeGreaterThan(55);
    expect(r).toBeLessThan(64);
    expect(s.moon.radius).toBeCloseTo(0.2724, 3);
  });

  it('is a pure function of time', () => {
    expect(sceneAt(t)).toEqual(s);
  });
});
