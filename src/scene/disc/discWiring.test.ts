import { SearchMoonPhase } from 'astronomy-engine';
import { Group, OrthographicCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { MS_PER_DAY } from '../../astro/constants';
import { computeSystemState } from '../../astro/ephemeris';
import { dot, scale, sub } from '../../astro/vec';
import { brightLimbAngleDeg, toDiscScene } from '../../sim/discScene';
import { toSkyScene } from '../../sim/skyScene';
import { applyRotation } from '../applyTransform';
import { NEAR_SIDE_POINT } from '../bodyLocal';

/**
 * The disc as rendered: disc state → applyRotation → real three camera and Moon → screen. Catches
 * a mirrored camera, wrong "up" or misapplied Moon orientation that the pure tests cannot.
 */

const TROMSO = { latitude: 69.65, longitude: 18.96 };
const DEG = 180 / Math.PI;

function rendered(ms: number) {
  const state = computeSystemState(new Date(ms));
  const disc = toDiscScene(state, toSkyScene(state, TROMSO, { bodySize: 1 }));
  const camera = new OrthographicCamera(-1.12, 1.12, 1.12, -1.12, 0.1, 20);
  const p = disc.cameraPosition;
  camera.position.set(p.x, p.y, p.z);
  applyRotation(camera, disc.cameraRotation);
  camera.updateMatrixWorld();
  const moon = new Group();
  applyRotation(moon, disc.moonRotation);
  moon.updateMatrixWorld();
  return { disc, camera, moon };
}

const ndc = (camera: OrthographicCamera, v: { x: number; y: number; z: number }) =>
  new Vector3(v.x, v.y, v.z).project(camera);

const crescent =
  (SearchMoonPhase(0, new Date(Date.UTC(2026, 9, 1)), 40)?.date.getTime() ?? 0) + 4 * MS_PER_DAY;

describe('rendered Moon disc', () => {
  it('draws the bright limb where the maths says, on screen', () => {
    for (const t of [crescent, crescent + 4 * MS_PER_DAY, crescent + 18 * MS_PER_DAY]) {
      const { disc, camera } = rendered(t);
      // Surface point on the limb toward the Sun.
      const onSky = sub(
        disc.sunDirection,
        scale(disc.viewDirection, dot(disc.sunDirection, disc.viewDirection)),
      );
      const len = Math.hypot(onSky.x, onSky.y, onSky.z);
      const limb = ndc(camera, scale(onSky, 1 / len));
      const onScreen = Math.atan2(limb.x, limb.y) * DEG;
      let diff = onScreen - brightLimbAngleDeg(disc);
      diff -= 360 * Math.round(diff / 360);
      expect(Math.abs(diff)).toBeLessThan(0.5);
      // The limb sits on the disc's edge: one Moon radius from the centre in a ±1.12 frame.
      expect(Math.hypot(limb.x, limb.y)).toBeCloseTo(1 / 1.12, 3);
    }
  });

  it("keeps the observer's zenith straight up", () => {
    const { camera } = rendered(crescent);
    const centre = ndc(camera, { x: 0, y: 0, z: 0 });
    const above = ndc(camera, { x: 0, y: 0.1, z: 0 });
    expect(above.y - centre.y).toBeGreaterThan(0);
    expect(Math.abs(above.x - centre.x)).toBeLessThan(1e-9);
  });

  it('shows the near side, within libration', () => {
    for (const t of [crescent, crescent + 10 * MS_PER_DAY]) {
      const { disc, moon } = rendered(t);
      const nearSide = moon.localToWorld(NEAR_SIDE_POINT.clone()).normalize();
      const towardViewer = new Vector3(
        disc.viewDirection.x,
        disc.viewDirection.y,
        disc.viewDirection.z,
      );
      expect(nearSide.angleTo(towardViewer) * DEG).toBeLessThan(11);
    }
  });
});
