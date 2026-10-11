import type { RotationMatrix, Vector } from 'astronomy-engine';

/** Plain 3-vector. Deliberately not astronomy-engine's `Vector` (which carries a time) or three's. */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Row-major 3×3 matrix: `out = M · v`, so `m[r][c]`. Columns of an orientation matrix are the
 * body's axes expressed in the parent frame.
 */
export type Mat3 = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

export const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export const fromAstro = (v: Vector): Vec3 => ({ x: v.x, y: v.y, z: v.z });

export const add = (a: Vec3, b: Vec3): Vec3 => vec(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 => vec(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: Vec3, k: number): Vec3 => vec(a.x * k, a.y * k, a.z * k);
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 =>
  vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);

export function normalize(a: Vec3): Vec3 {
  const len = length(a);
  if (len === 0) throw new Error('Cannot normalize a zero vector');
  return scale(a, 1 / len);
}

/** Angle between two vectors, in degrees. */
export function angleBetweenDeg(a: Vec3, b: Vec3): number {
  const c = dot(a, b) / (length(a) * length(b));
  return (Math.acos(Math.min(1, Math.max(-1, c))) * 180) / Math.PI;
}

export const mulVec = (m: Mat3, v: Vec3): Vec3 =>
  vec(
    m[0][0] * v.x + m[0][1] * v.y + m[0][2] * v.z,
    m[1][0] * v.x + m[1][1] * v.y + m[1][2] * v.z,
    m[2][0] * v.x + m[2][1] * v.y + m[2][2] * v.z,
  );

export function mul(a: Mat3, b: Mat3): Mat3 {
  const cell = (r: 0 | 1 | 2, c: 0 | 1 | 2) =>
    a[r][0] * b[0][c] + a[r][1] * b[1][c] + a[r][2] * b[2][c];
  return [
    [cell(0, 0), cell(0, 1), cell(0, 2)],
    [cell(1, 0), cell(1, 1), cell(1, 2)],
    [cell(2, 0), cell(2, 1), cell(2, 2)],
  ];
}

export const transpose = (m: Mat3): Mat3 => [
  [m[0][0], m[1][0], m[2][0]],
  [m[0][1], m[1][1], m[2][1]],
  [m[0][2], m[1][2], m[2][2]],
];

/** Matrix whose columns are the given vectors. */
export const fromColumns = (x: Vec3, y: Vec3, z: Vec3): Mat3 => [
  [x.x, y.x, z.x],
  [x.y, y.y, z.y],
  [x.z, y.z, z.z],
];

/** Matrix whose rows are the given vectors. */
export const fromRows = (x: Vec3, y: Vec3, z: Vec3): Mat3 => [
  [x.x, x.y, x.z],
  [y.x, y.y, y.z],
  [z.x, z.y, z.z],
];

export const column = (m: Mat3, c: 0 | 1 | 2): Vec3 => vec(m[0][c], m[1][c], m[2][c]);

/**
 * astronomy-engine stores `rot[i][j]` such that `out[j] = Σ_i rot[i][j] · v[i]` — the transpose of
 * our row-major convention.
 */
export function fromAstroRotation(r: RotationMatrix): Mat3 {
  const at = (i: number, j: number): number => {
    const value = r.rot[i]?.[j];
    if (value === undefined) throw new Error('Malformed RotationMatrix');
    return value;
  };
  return [
    [at(0, 0), at(1, 0), at(2, 0)],
    [at(0, 1), at(1, 1), at(2, 1)],
    [at(0, 2), at(1, 2), at(2, 2)],
  ];
}
