import { getSunLightColor, SkyLightProbe } from '@takram/three-atmosphere';
import { readFileSync } from 'node:fs';
import { Color, DataTexture, HalfFloatType, Vector3 } from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { describe, expect, it } from 'vitest';
import { computeSystemState } from '../../astro/ephemeris';
import type { Vec3 } from '../../astro/vec';
import { GROUND_ALBEDO, groundRadiance, luminance } from '../../sim/groundLight';
import { toSkyScene } from '../../sim/skyScene';
import { LOCATION_PRESETS } from '../../state/locations';
import { setWorldToEcef } from './worldToEcef';

/**
 * Feeds the self-hosted precomputed atmosphere (the same EXRs the sky view loads) with OUR sun
 * direction and observer position, through takram's CPU helpers, and checks the ground's lighting
 * inputs behave physically. The sky shader evaluates the same Bruneton ground term on the GPU, so a
 * wrong ECEF sun direction or observer position would show up here as a dark noon or a lit night.
 */

function loadExr(name: string): DataTexture {
  const file = readFileSync(new URL(`../../../public/atmosphere/${name}`, import.meta.url));
  const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  const exr = new EXRLoader().setDataType(HalfFloatType).parse(buffer);
  const texture = new DataTexture(exr.data, exr.width, exr.height);
  texture.type = exr.type ?? HalfFloatType;
  return texture;
}

const transmittance = loadExr('transmittance.exr');
const irradiance = loadExr('irradiance.exr');
const toVec = (c: Color | Vector3): Vec3 =>
  c instanceof Color ? { x: c.r, y: c.g, z: c.b } : { x: c.x, y: c.y, z: c.z };

const observer = LOCATION_PRESETS.tromso;

function lightingAt(ms: number) {
  const sky = toSkyScene(computeSystemState(new Date(ms)), observer, { moonSize: 1 });
  const position = new Vector3(sky.observerEcefM.x, sky.observerEcefM.y, sky.observerEcefM.z);
  const sun = new Vector3(sky.sunDirectionEcef.x, sky.sunDirectionEcef.y, sky.sunDirectionEcef.z);

  const sunIrradiance = toVec(getSunLightColor(transmittance, position, sun));

  const probe = new SkyLightProbe({ irradianceTexture: irradiance, sunDirection: sun });
  setWorldToEcef(probe.worldToECEFMatrix, sky.skyToEcef, sky.observerEcefM);
  probe.update();
  // The probe stores irradiance × L0 = irradiance / √π in its constant SH coefficient.
  const [constantTerm] = probe.sh.coefficients;
  if (!constantTerm) throw new Error('SkyLightProbe has no SH coefficients');
  const skyIrradiance = toVec(constantTerm.clone().multiplyScalar(Math.sqrt(Math.PI)));

  const altitude = sky.sun.altitude;
  return {
    altitude,
    sunIrradiance,
    skyIrradiance,
    ground: groundRadiance(GROUND_ALBEDO, sunIrradiance, altitude, skyIrradiance),
  };
}

// Tromsø at the March equinox: noon Sun ~20° up, a long twilight either side.
const DAY_START = Date.UTC(2026, 2, 20, 0, 0);
const samples = Array.from({ length: 24 * 6 }, (_, i) => lightingAt(DAY_START + i * 600_000));
const daytime = samples.filter((s) => s.altitude > 0).sort((a, b) => a.altitude - b.altitude);
const noon = daytime.at(-1) ?? samples[0];
if (!noon) throw new Error('no samples');

describe('ground lighting inputs (sky view)', () => {
  it('covers a real day', () => {
    expect(noon.altitude).toBeGreaterThan(18);
    expect(noon.altitude).toBeLessThan(22);
    expect(samples.some((s) => s.altitude < -12)).toBe(true);
  });

  it('gets no direct sunlight once the Sun is below the horizon', () => {
    for (const s of samples.filter((x) => x.altitude < -1)) {
      expect(luminance(s.sunIrradiance)).toBe(0);
    }
  });

  it('brightens monotonically as the Sun climbs', () => {
    daytime.slice(1).forEach((s, i) => {
      const prev = daytime[i];
      if (prev)
        expect(luminance(s.ground)).toBeGreaterThanOrEqual(luminance(prev.ground) * (1 - 1e-6));
    });
    expect(luminance(noon.ground)).toBeGreaterThan(0);
  });

  it('is still lit by the sky in civil twilight, far dimmer than at noon', () => {
    const civil = samples.filter((s) => s.altitude < -1 && s.altitude > -6);
    expect(civil.length).toBeGreaterThan(0);
    for (const s of civil) {
      expect(luminance(s.ground)).toBeGreaterThan(0);
      expect(luminance(s.ground)).toBeLessThan(luminance(noon.ground) / 10);
    }
  });

  it('is lit by redder sunlight near sunset than at noon', () => {
    const low = daytime.find((s) => s.altitude > 1 && s.altitude < 4);
    if (!low) throw new Error('no low-Sun sample');
    const redness = (c: Vec3) => c.x / c.z;
    expect(redness(low.sunIrradiance)).toBeGreaterThan(redness(noon.sunIrradiance) * 1.2);
  });
});
