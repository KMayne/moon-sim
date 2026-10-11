import {
  Body,
  Equator,
  Horizon,
  Illumination,
  Observer,
  SearchHourAngle,
  SearchMoonPhase,
} from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { MS_PER_DAY } from '../astro/constants';
import { computeSystemState } from '../astro/ephemeris';
import { angleBetweenDeg, column, cross, dot, scale, sub, vec, type Vec3 } from '../astro/vec';
import { brightLimbAngleDeg, litDiscFraction, toDiscScene } from './discScene';
import { toSkyScene } from './skyScene';

const TROMSO = { latitude: 69.65, longitude: 18.96 };
const PARANAL = { latitude: -24.63, longitude: -70.4 };
const DEG = 180 / Math.PI;

const discAt = (ms: number, observer = TROMSO) => {
  const state = computeSystemState(new Date(ms));
  return toDiscScene(state, toSkyScene(state, observer, { bodySize: 1 }));
};

/** Sky-world unit vector (x north, y up, z east) for an alt/az. */
function skyDir(altitude: number, azimuth: number): Vec3 {
  const alt = altitude / DEG;
  const az = azimuth / DEG;
  return vec(Math.cos(alt) * Math.cos(az), Math.sin(alt), Math.cos(alt) * Math.sin(az));
}

/** Topocentric, unrefracted direction of a body from astronomy-engine alone. */
function referenceDir(body: Body, ms: number, observer: typeof TROMSO): Vec3 {
  const date = new Date(ms);
  const obs = new Observer(observer.latitude, observer.longitude, 0);
  const eq = Equator(body, date, obs, true, true);
  const hor = Horizon(date, obs, eq.ra, eq.dec);
  return skyDir(hor.altitude, hor.azimuth);
}

const onSkyPlane = (v: Vec3, lineOfSight: Vec3): Vec3 =>
  sub(v, scale(lineOfSight, dot(v, lineOfSight)));

/** Phase instants (0 new, 90 first quarter, 180 full, 270 last quarter) after a start date. */
const phaseAt = (lon: number, from: number): number => {
  const t = SearchMoonPhase(lon, new Date(from), 40);
  if (!t) throw new Error('phase search failed');
  return t.date.getTime();
};

const START = Date.UTC(2026, 9, 1);
const CRESCENT = phaseAt(0, START) + 3 * MS_PER_DAY;
const FIRST_QUARTER = phaseAt(90, START);
const LAST_QUARTER = phaseAt(270, START);
const FULL = phaseAt(180, START);

describe('toDiscScene', () => {
  it('has an orthonormal, right-handed camera looking at the Moon', () => {
    for (const t of [CRESCENT, FIRST_QUARTER, FULL, LAST_QUARTER]) {
      const disc = discAt(t);
      const [r, u, b] = [0, 1, 2].map((c) => column(disc.cameraRotation, c as 0 | 1 | 2)) as [
        Vec3,
        Vec3,
        Vec3,
      ];
      for (const v of [r, u, b]) expect(dot(v, v)).toBeCloseTo(1, 12);
      expect(dot(r, u)).toBeCloseTo(0, 12);
      expect(dot(u, b)).toBeCloseTo(0, 12);
      expect(dot(b, r)).toBeCloseTo(0, 12);
      expect(angleBetweenDeg(cross(r, u), b)).toBeLessThan(1e-4);
      // Camera sits on the observer's side, looking at the Moon at the origin.
      expect(angleBetweenDeg(scale(disc.cameraPosition, -1), scale(b, -1))).toBeLessThan(1e-4);
      expect(disc.up).toBe('zenith');
    }
  });

  it('puts celestial north up at upper culmination (northern hemisphere)', () => {
    const obs = new Observer(TROMSO.latitude, TROMSO.longitude, 0);
    for (const from of [CRESCENT, FULL]) {
      const transit = SearchHourAngle(Body.Moon, obs, 0, new Date(from));
      const disc = discAt(transit.time.date.getTime());
      const lineOfSight = scale(disc.viewDirection, -1);
      const pole = onSkyPlane(skyDir(TROMSO.latitude, 0), lineOfSight);
      expect(angleBetweenDeg(pole, column(disc.cameraRotation, 1))).toBeLessThan(1);
    }
  });

  it('points the bright limb toward the Sun, as astronomy-engine places them (≤ 1°)', () => {
    for (const [t, observer] of [
      [CRESCENT, TROMSO],
      [FIRST_QUARTER, TROMSO],
      [LAST_QUARTER, TROMSO],
      [CRESCENT, PARANAL],
      [LAST_QUARTER, PARANAL],
    ] as const) {
      const disc = discAt(t, observer);
      const moon = referenceDir(Body.Moon, t, observer);
      const sun = referenceDir(Body.Sun, t, observer);
      const toSun = onSkyPlane(sun, moon);
      const zenith = onSkyPlane(vec(0, 1, 0), moon);
      const right = cross(moon, zenith);
      const expected = Math.atan2(dot(toSun, right), dot(toSun, zenith)) * DEG;
      let diff = brightLimbAngleDeg(disc) - expected;
      diff -= 360 * Math.round(diff / 360);
      expect(Math.abs(diff)).toBeLessThan(1);
    }
  });

  it('tilts the crescent very differently at Tromsø and Paranal', () => {
    const tromso = brightLimbAngleDeg(discAt(CRESCENT, TROMSO));
    const paranal = brightLimbAngleDeg(discAt(CRESCENT, PARANAL));
    let diff = Math.abs(tromso - paranal) % 360;
    if (diff > 180) diff = 360 - diff;
    expect(diff).toBeGreaterThan(20);
  });

  it('lights the same fraction of the disc as astronomy-engine reports (≤ 1%)', () => {
    for (const t of [CRESCENT, FIRST_QUARTER, FULL, LAST_QUARTER, CRESCENT + 9 * MS_PER_DAY]) {
      const expected = Illumination(Body.Moon, new Date(t)).phase_fraction;
      expect(Math.abs(litDiscFraction(discAt(t)) - expected)).toBeLessThan(0.01);
    }
  });

  it('makes earthshine strongest near new moon and absent at full', () => {
    expect(discAt(CRESCENT).earthLitFraction).toBeGreaterThan(0.9);
    expect(discAt(FULL).earthLitFraction).toBeLessThan(0.01);
  });

  it('reports the Moon below the horizon when it is', () => {
    const obs = new Observer(TROMSO.latitude, TROMSO.longitude, 0);
    const lower = SearchHourAngle(Body.Moon, obs, 12, new Date(FULL));
    const disc = discAt(lower.time.date.getTime());
    // Lower culmination at 69.65°N: below the horizon unless the Moon is far north.
    const moon = referenceDir(Body.Moon, lower.time.date.getTime(), TROMSO);
    expect(Math.sign(disc.moonAltitudeDeg)).toBe(Math.sign(moon.y));
  });
});
