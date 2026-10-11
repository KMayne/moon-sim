import { SphereGeometry, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { localSurfacePoint } from './bodyLocal';

/**
 * Both texture maps are equirectangular and centred on 0° longitude, so longitude λ sits at
 * u = (λ + 180) / 360. This checks three's SphereGeometry UVs agree with our local surface
 * convention (bodyLocal.ts / sim/axes.ts), i.e. the texture lands on the right meridians.
 */
function uvNearest(geometry: SphereGeometry, target: Vector3): { u: number; v: number } {
  const pos = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  let best = { d: Infinity, u: 0, v: 0 };
  const p = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const d = p.distanceToSquared(target);
    if (d < best.d) best = { d, u: uv.getX(i), v: uv.getY(i) };
  }
  return best;
}

describe('texture longitude alignment', () => {
  // 72 segments = 5° steps, so sampled longitudes fall exactly on vertices.
  const sphere = new SphereGeometry(1, 72, 36);

  it.each([-150, -90, -45, 0, 45, 90, 150])('lon %i° maps to u = (lon + 180) / 360', (lon) => {
    expect(uvNearest(sphere, localSurfacePoint(0, lon)).u).toBeCloseTo((lon + 180) / 360, 6);
  });

  it.each([-60, 0, 60])('lat %i° maps to v = (lat + 90) / 180', (lat) => {
    expect(uvNearest(sphere, localSurfacePoint(lat, 30)).v).toBeCloseTo((lat + 90) / 180, 6);
  });
});
