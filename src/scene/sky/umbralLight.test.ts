import { getSunLightColor } from '@takram/three-atmosphere';
import { readFileSync } from 'node:fs';
import { Color, DataTexture, HalfFloatType, Vector3 } from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { describe, expect, it } from 'vitest';
import { computeUmbralTable, refractionBending, type Rgb } from '../../sim/umbralLight';
import { UMBRAL_TABLE } from '../../sim/umbralLight.table';

/**
 * The committed lookup (umbralLight.table.ts) must be exactly what the model gives with the
 * self-hosted transmittance tables the sky view renders with. To regenerate after changing the
 * model, print `computeUmbralTable(halfPath)` and paste it into the table file.
 */
const file = readFileSync(new URL('../../../public/atmosphere/transmittance.exr', import.meta.url));
const exr = new EXRLoader()
  .setDataType(HalfFloatType)
  .parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
const transmittance = new DataTexture(exr.data, exr.width, exr.height);
transmittance.type = HalfFloatType;

/** takram's atmosphere: ground at 6360 km, top at 6420 km. Our h is altitude above the ground. */
const BOTTOM_M = 6_360_000;
const options = { correctAltitude: false };
const horizontal = new Vector3(0, 1, 0);
const outside = getSunLightColor(
  transmittance,
  new Vector3(0, 0, 6_430_000),
  horizontal,
  new Color(),
  options,
);

/** Transmittance from altitude h horizontally to space: sunlight there ÷ sunlight in space. */
function halfPath(hKm: number): Rgb {
  const c = getSunLightColor(
    transmittance,
    new Vector3(0, 0, BOTTOM_M + hKm * 1000),
    horizontal,
    new Color(),
    options,
  );
  return [c.r / outside.r, c.g / outside.g, c.b / outside.b];
}

describe('umbral light model', () => {
  it('bends sea-level grazing rays by ~1.2° (twice the horizontal refraction)', () => {
    expect((refractionBending(0) * 180) / Math.PI).toBeGreaterThan(1.1);
    expect((refractionBending(0) * 180) / Math.PI).toBeLessThan(1.25);
  });

  it('committed table matches the model run on the self-hosted transmittance', () => {
    const table = computeUmbralTable(halfPath);
    expect(table).toHaveLength(UMBRAL_TABLE.length);
    table.forEach((rgb, i) => {
      rgb.forEach((v, c) => {
        const committed = UMBRAL_TABLE[i]?.[c] ?? NaN;
        expect(Math.abs(v - committed)).toBeLessThanOrEqual(Math.abs(committed) * 1e-3 + 1e-12);
      });
    });
  }, 60_000);

  it('is red and ~1e-4 of sunlight in the centre, brighter and whiter near the edge', () => {
    const centre = UMBRAL_TABLE[0] ?? [0, 0, 0];
    const edge = UMBRAL_TABLE[30] ?? [0, 0, 0]; // x ≈ 0.95
    const lum = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    expect(lum(centre)).toBeGreaterThan(1e-5);
    expect(lum(centre)).toBeLessThan(3e-4);
    expect(centre[0] / centre[1]).toBeGreaterThan(10);
    expect(lum(edge) / lum(centre)).toBeGreaterThan(5);
    expect(edge[0] / edge[1]).toBeLessThan(centre[0] / centre[1]);
  });
});
