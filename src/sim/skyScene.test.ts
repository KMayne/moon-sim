import { Body, Equator, Horizon, Observer } from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { computeSystemState } from '../astro/ephemeris';
import { angleBetweenDeg, column, mulVec, transpose, vec, type Vec3 } from '../astro/vec';
import { sampleDailyArcs } from './skyArcs';
import { toSkyScene } from './skyScene';

const TROMSO = { latitude: 69.65, longitude: 18.96 };
const T = Date.UTC(2026, 9, 11, 22, 30);

/** Sky-world unit vector (x north, y up, z east) for an alt/az from astronomy-engine. */
function skyDir(altitude: number, azimuth: number): Vec3 {
  const alt = (altitude * Math.PI) / 180;
  const az = (azimuth * Math.PI) / 180;
  return vec(Math.cos(alt) * Math.cos(az), Math.sin(alt), Math.cos(alt) * Math.sin(az));
}

function reference(body: Body, ms: number) {
  const date = new Date(ms);
  const observer = new Observer(TROMSO.latitude, TROMSO.longitude, 0);
  const eq = Equator(body, date, observer, true, true);
  return Horizon(date, observer, eq.ra, eq.dec);
}

describe('toSkyScene', () => {
  const state = computeSystemState(new Date(T));
  const sky = toSkyScene(state, TROMSO, { moonSize: 1 });

  it('places Sun and Moon where astronomy-engine puts them (≤ 0.1°)', () => {
    for (const [body, dir] of [
      [Body.Sun, sky.sunDirection],
      [Body.Moon, sky.moonDirection],
    ] as const) {
      const ref = reference(body, T);
      expect(angleBetweenDeg(dir, skyDir(ref.altitude, ref.azimuth))).toBeLessThan(0.1);
    }
  });

  it('gives the atmosphere renderer the same Sun direction via ECEF', () => {
    const viaEcef = mulVec(transpose(sky.skyToEcef), sky.sunDirectionEcef);
    expect(angleBetweenDeg(viaEcef, sky.sunDirection)).toBeLessThan(0.01);
  });

  it('puts the celestial pole at altitude ≈ latitude, due north', () => {
    const pole = mulVec(sky.eqjToSky, vec(0, 0, 1));
    expect(angleBetweenDeg(pole, skyDir(TROMSO.latitude, 0))).toBeLessThan(0.5);
  });

  it('orients the Moon so its near side faces the observer (within libration + parallax)', () => {
    const nearSide = column(sky.moonRotation, 0);
    const towardObserver = vec(-sky.moonDirection.x, -sky.moonDirection.y, -sky.moonDirection.z);
    expect(angleBetweenDeg(nearSide, towardObserver)).toBeLessThan(12);
  });

  it('sizes the Moon at its true ~0.25° angular radius, scaled only by the visual aid', () => {
    const deg = (sky.moonAngularRadius * 180) / Math.PI;
    expect(deg).toBeGreaterThan(0.24);
    expect(deg).toBeLessThan(0.29);
    const scaled = toSkyScene(state, TROMSO, { moonSize: 4 });
    expect(scaled.moonAngularRadius).toBeCloseTo(sky.moonAngularRadius * 4, 12);
    expect(scaled.moonDirection).toEqual(sky.moonDirection);
  });
});

describe('sampleDailyArcs', () => {
  const arcs = sampleDailyArcs(T, TROMSO);

  it('samples ±12 h at 10-minute steps, centred on now', () => {
    expect(arcs.sun).toHaveLength(145);
    expect(arcs.centreIndex).toBe(72);
  });

  it('centre samples match the current Sun and Moon directions', () => {
    const sky = toSkyScene(computeSystemState(new Date(T)), TROMSO, { moonSize: 1 });
    expect(angleBetweenDeg(arcs.sun[72] ?? vec(0, 0, 0), sky.sunDirection)).toBeLessThan(1e-4);
    expect(angleBetweenDeg(arcs.moon[72] ?? vec(0, 0, 0), sky.moonDirection)).toBeLessThan(1e-4);
  });

  it('every sample matches astronomy-engine (≤ 0.1°)', () => {
    for (const i of [0, 30, 100, 144]) {
      const ms = T + (i - 72) * 600_000;
      const ref = reference(Body.Moon, ms);
      expect(
        angleBetweenDeg(arcs.moon[i] ?? vec(0, 0, 0), skyDir(ref.altitude, ref.azimuth)),
      ).toBeLessThan(0.1);
    }
  });
});
