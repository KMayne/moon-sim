import { describe, expect, it } from 'vitest';
import { MS_PER_DAY } from '../astro/constants';
import { computeSystemState } from '../astro/ephemeris';
import { angleBetweenDeg, column, length, mulVec, normalize, scale, sub } from '../astro/vec';
import { sampleMoonOrbitEqj } from './orbitPath';
import { KM_TO_SCENE, toOrbitScene } from './orbitScene';
import {
  MOON_DISTANCE_RANGE,
  BODY_SIZE_RANGE,
  minMoonDistance,
  resolveVisualScale,
  TRUE_SCALE,
  type VisualScale,
} from './visualScale';

const HOUR_MS = 3_600_000;
const T = Date.UTC(2026, 3, 14, 6);

/** The most extreme settings the UI allows. */
const EXTREME: VisualScale = {
  bodySize: BODY_SIZE_RANGE.max,
  moonDistance: MOON_DISTANCE_RANGE.min,
};
const CLOSE: VisualScale = { bodySize: 1, moonDistance: MOON_DISTANCE_RANGE.min };

describe('resolveVisualScale', () => {
  it('defaults to true scale', () => {
    expect(resolveVisualScale(TRUE_SCALE)).toEqual(TRUE_SCALE);
    expect(toOrbitScene(computeSystemState(new Date(T))).visualScale).toEqual(TRUE_SCALE);
  });

  it('clamps requests to the supported ranges', () => {
    expect(resolveVisualScale({ bodySize: 100, moonDistance: 3 })).toEqual({
      bodySize: BODY_SIZE_RANGE.max,
      moonDistance: 1,
    });
    expect(resolveVisualScale({ bodySize: 0.1, moonDistance: 0.001 })).toEqual({
      bodySize: 1,
      moonDistance: MOON_DISTANCE_RANGE.min,
    });
  });

  it('pushes a large Moon out just far enough to clear Earth', () => {
    const resolved = resolveVisualScale(EXTREME);
    expect(resolved.bodySize).toBe(BODY_SIZE_RANGE.max);
    expect(resolved.moonDistance).toBeCloseTo(minMoonDistance(BODY_SIZE_RANGE.max), 12);
    expect(resolved.moonDistance).toBeGreaterThan(MOON_DISTANCE_RANGE.min);
    // A true-size Moon can come all the way in.
    expect(resolveVisualScale(CLOSE)).toEqual(CLOSE);
  });
});

describe('visual aids in the orbit scene', () => {
  const state = computeSystemState(new Date(T));
  const truth = toOrbitScene(state);
  // 0.5× is above the clearance minimum for 10× bodies, so it applies unmodified.
  const aided = toOrbitScene(state, { bodySize: 10, moonDistance: 0.5 });

  it('scales Earth and Moon radii by bodySize exactly', () => {
    expect(aided.moon.radius).toBeCloseTo(truth.moon.radius * 10, 12);
    expect(aided.earth.radius).toBeCloseTo(truth.earth.radius * 10, 12);
  });

  it('scales the Moon distance by moonDistance exactly, keeping its direction', () => {
    expect(length(aided.moon.position)).toBeCloseTo(length(truth.moon.position) * 0.5, 9);
    expect(angleBetweenDeg(aided.moon.position, truth.moon.position)).toBeCloseTo(0, 9);
  });

  it('leaves positions of Earth and Sun, orientations and the frame untouched', () => {
    expect(aided.earth.position).toEqual(truth.earth.position);
    expect(aided.earth.rotation).toEqual(truth.earth.rotation);
    expect(aided.sunDirection).toEqual(truth.sunDirection);
    expect(aided.eqjToScene).toEqual(truth.eqjToScene);
    expect(aided.moon.rotation).toEqual(truth.moon.rotation);
  });

  it('keeps the Moon on its (equally scaled) orbit path', () => {
    const path = sampleMoonOrbitEqj(T);
    const middle = path[Math.floor(path.length / 2)];
    if (!middle) throw new Error('empty path');
    const onPath = mulVec(
      aided.eqjToScene,
      scale(middle, KM_TO_SCENE * aided.visualScale.moonDistance),
    );
    expect(length(sub(onPath, aided.moon.position))).toBeLessThan(1e-9);
  });
});

describe('acceptance under visual aids (hourly, one year)', () => {
  const start = Date.UTC(2026, 0, 1);
  const hours = Array.from({ length: Math.ceil((365.25 * MS_PER_DAY) / HOUR_MS) }, (_, i) => i);

  for (const [name, request] of [
    ['closest true-size Moon', CLOSE],
    ['largest, closest Moon', EXTREME],
  ] as const) {
    it(`near-side marker faces Earth: ${name}`, () => {
      let worst = 0;
      for (const h of hours) {
        const s = toOrbitScene(computeSystemState(new Date(start + h * HOUR_MS)), request);
        const towardEarth = sub(s.earth.position, s.moon.position);
        worst = Math.max(worst, angleBetweenDeg(column(s.moon.rotation, 0), towardEarth));
      }
      expect(worst).toBeLessThan(11);
    });

    it(`Moon never intersects Earth: ${name}`, () => {
      let minGap = Infinity;
      for (const h of hours) {
        const s = toOrbitScene(computeSystemState(new Date(start + h * HOUR_MS)), request);
        minGap = Math.min(minGap, length(s.moon.position) - s.earth.radius - s.moon.radius);
      }
      expect(minGap).toBeGreaterThan(0.5 - 1e-9);
    });
  }

  it('Moon direction is identical with and without aids', () => {
    const s0 = toOrbitScene(computeSystemState(new Date(start)));
    const s1 = toOrbitScene(computeSystemState(new Date(start)), EXTREME);
    expect(angleBetweenDeg(normalize(s0.moon.position), normalize(s1.moon.position))).toBeLessThan(
      1e-9,
    );
  });
});
