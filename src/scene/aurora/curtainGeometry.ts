import { BufferGeometry, Float32BufferAttribute } from 'three';

export interface CurtainBounds {
  /** Azimuth range, degrees clockwise from north; `azTo` may exceed 360 to wrap through north. */
  azFrom: number;
  azTo: number;
  altFrom: number;
  altTo: number;
  radius: number;
}

const DEG = Math.PI / 180;

/**
 * A band of the inside of a sphere in the sky view's North-Up-East frame (x north, y up, z east).
 * uv.x runs along azimuth, uv.y up the curtain.
 */
export function curtainGeometry(b: CurtainBounds, columns = 96, rows = 16): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    const alt = (b.altFrom + v * (b.altTo - b.altFrom)) * DEG;
    for (let i = 0; i <= columns; i++) {
      const u = i / columns;
      const az = (b.azFrom + u * (b.azTo - b.azFrom)) * DEG;
      positions.push(
        b.radius * Math.cos(alt) * Math.cos(az),
        b.radius * Math.sin(alt),
        b.radius * Math.cos(alt) * Math.sin(az),
      );
      uvs.push(u, v);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < columns; i++) {
      const a = j * (columns + 1) + i;
      const c = a + columns + 1;
      index.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  return geometry;
}
