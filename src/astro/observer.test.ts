import { Body, Equator, Horizon, Observer } from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { computeSystemState } from './ephemeris';
import { altAz, eqjToHorizon, observerEcefKm, topocentric, type Geodetic } from './observer';
import { mulVec } from './vec';

const SITES: Geodetic[] = [
  { latitude: 69.65, longitude: 18.96 },
  { latitude: 19.82, longitude: -155.47 },
  { latitude: -24.63, longitude: -70.4 },
];
const TIMES = [Date.UTC(2026, 0, 3, 5), Date.UTC(2026, 5, 21, 12), Date.UTC(2026, 9, 11, 22, 30)];

/** Shortest signed difference between two azimuths, degrees. */
const azDiff = (a: number, b: number) => ((((a - b) % 360) + 540) % 360) - 180;

describe('horizon frame', () => {
  for (const site of SITES) {
    for (const t of TIMES) {
      const date = new Date(t);
      const state = computeSystemState(date);
      const toHor = eqjToHorizon(state.earthOrientation, site);
      const observer = new Observer(site.latitude, site.longitude, 0);

      for (const [name, body, geo] of [
        ['Sun', Body.Sun, state.sun],
        ['Moon', Body.Moon, state.moon],
      ] as const) {
        it(`${name} alt/az matches astronomy-engine at ${site.latitude}° on ${date.toISOString()}`, () => {
          const ours = altAz(mulVec(toHor, topocentric(geo, state.earthOrientation, site)));
          const eq = Equator(body, date, observer, true, true);
          const theirs = Horizon(date, observer, eq.ra, eq.dec);
          expect(Math.abs(ours.altitude - theirs.altitude)).toBeLessThan(0.1);
          // Azimuth is degenerate near the zenith; scale tolerance by cos(alt).
          const azTol = 0.1 / Math.max(0.05, Math.cos((ours.altitude * Math.PI) / 180));
          expect(Math.abs(azDiff(ours.azimuth, theirs.azimuth))).toBeLessThan(azTol);
        });
      }
    }
  }
});

describe('observerEcefKm', () => {
  it('puts the equator/Greenwich point at the equatorial radius on +x', () => {
    const p = observerEcefKm({ latitude: 0, longitude: 0 });
    expect(p.x).toBeCloseTo(6378.137, 3);
    expect(p.y).toBeCloseTo(0, 9);
    expect(p.z).toBeCloseTo(0, 9);
  });

  it('puts the north pole at the polar radius', () => {
    expect(observerEcefKm({ latitude: 90, longitude: 0 }).z).toBeCloseTo(6356.752, 2);
  });
});
