import { MOON_RADIUS_KM, SUN_RADIUS_KM } from '../astro/constants';
import type { SystemState } from '../astro/ephemeris';
import {
  cross,
  dot,
  length,
  mulVec,
  normalize,
  scale,
  sub,
  vec,
  type Mat3,
  type Vec3,
} from '../astro/vec';
import { UMBRAL_TABLE } from './umbralLight.table';
import {
  EARTH_SHADOW_RADIUS_KM,
  UMBRAL_TABLE_MAX_X,
  UMBRAL_TABLE_SIZE,
  type Rgb,
} from './umbralLight';

/**
 * Eclipse geometry, generic in which body casts the shadow: Earth for lunar eclipses here, the Moon
 * for solar eclipses. All positions are km in any one consistent frame.
 */

export interface Sphere {
  readonly center: Vec3;
  readonly radius: number;
}

export { EARTH_SHADOW_RADIUS_KM };

/** Angle between two vectors (rad), accurate near 0 and π (atan2 of |a×b| and a·b). */
export function angleBetween(a: Vec3, b: Vec3): number {
  return Math.atan2(length(cross(a, b)), dot(a, b));
}

/**
 * Fraction of a disc of angular radius `a` covered by a disc of radius `b` whose centre is `d`
 * away (all angles, small enough to treat the sky as flat). Exact circle–circle overlap.
 */
export function discCoveredFraction(a: number, b: number, d: number): number {
  if (a <= 0) return 0;
  if (d >= a + b) return 0;
  if (d <= b - a) return 1; // occluder covers the whole disc
  if (d <= a - b) return (b * b) / (a * a); // occluder wholly inside the disc (annular)
  const alpha = Math.acos(Math.min(1, Math.max(-1, (d * d + a * a - b * b) / (2 * d * a))));
  const beta = Math.acos(Math.min(1, Math.max(-1, (d * d + b * b - a * a) / (2 * d * b))));
  const lens =
    a * a * alpha +
    b * b * beta -
    0.5 * Math.sqrt(Math.max(0, (-d + a + b) * (d + a - b) * (d - a + b) * (d + a + b)));
  return Math.min(1, Math.max(0, lens / (Math.PI * a * a)));
}

/**
 * Fraction of the Sun's disc visible from `point` past an occluding sphere (0 = in the umbra,
 * 1 = no eclipse). Points inside the occluder see nothing.
 */
export function visibleSolarFraction(point: Vec3, sun: Sphere, occluder: Sphere): number {
  const toSun = sub(sun.center, point);
  const toOccluder = sub(occluder.center, point);
  const occluderDistance = length(toOccluder);
  if (occluderDistance <= occluder.radius) return 0;
  const a = Math.asin(Math.min(1, sun.radius / length(toSun)));
  const b = Math.asin(Math.min(1, occluder.radius / occluderDistance));
  return 1 - discCoveredFraction(a, b, angleBetween(toSun, toOccluder));
}

/**
 * Where `point` sits in the shadow of `occluder`, in astronomy-engine's terms (its CalcShadow):
 * distances perpendicular to the Sun→occluder axis at the point's distance along it.
 */
export interface ShadowPosition {
  /** Distance beyond the occluder along the axis, as a fraction of the Sun–occluder distance. */
  readonly u: number;
  /** Distance of the point from the shadow axis, km. */
  readonly r: number;
  /** Umbra radius at that distance, km (negative beyond the umbra's apex). */
  readonly umbra: number;
  /** Penumbra radius at that distance, km. */
  readonly penumbra: number;
}

export function shadowPosition(point: Vec3, sun: Sphere, occluder: Sphere): ShadowPosition {
  const axis = sub(occluder.center, sun.center);
  const target = sub(point, occluder.center);
  const u = dot(axis, target) / dot(axis, axis);
  const r = length(sub(scale(axis, u), target));
  return {
    u,
    r,
    umbra: sun.radius - (1 + u) * (sun.radius - occluder.radius),
    penumbra: -sun.radius + (1 + u) * (sun.radius + occluder.radius),
  };
}

export type LunarEclipseKind = 'none' | 'penumbral' | 'partial' | 'total';

export interface LunarEclipseState extends ShadowPosition {
  /** The phase at this instant, by where the Moon's whole disc sits (astronomy-engine's rules). */
  readonly kind: LunarEclipseKind;
  /** Fraction of the Moon's diameter inside the umbra (> 1 at totality, ≤ 0 outside). */
  readonly umbralMagnitude: number;
  /** Fraction of the Moon's diameter inside the penumbra. */
  readonly penumbralMagnitude: number;
}

const sunSphere = (state: SystemState): Sphere => ({ center: state.sun, radius: SUN_RADIUS_KM });
const EARTH_SHADOW: Sphere = { center: vec(0, 0, 0), radius: EARTH_SHADOW_RADIUS_KM };

export function lunarEclipseState(state: SystemState): LunarEclipseState {
  const s = shadowPosition(state.moon, sunSphere(state), EARTH_SHADOW);
  const R = MOON_RADIUS_KM;
  const kind: LunarEclipseKind =
    s.r + R < s.umbra
      ? 'total'
      : s.r < s.umbra + R
        ? 'partial'
        : s.r < s.penumbra + R
          ? 'penumbral'
          : 'none';
  return {
    ...s,
    kind,
    umbralMagnitude: (s.umbra + R - s.r) / (2 * R),
    penumbralMagnitude: (s.penumbra + R - s.r) / (2 * R),
  };
}

/** Refracted (red) light inside Earth's shadow at x = r / umbra radius, relative to sunlight. */
export function umbralLight(x: number): Rgb {
  const f = (x / UMBRAL_TABLE_MAX_X) * UMBRAL_TABLE_SIZE - 0.5;
  if (f >= UMBRAL_TABLE_SIZE - 0.5 || x < 0) return [0, 0, 0];
  const i = Math.max(0, Math.floor(f));
  const t = Math.min(1, Math.max(0, f - i));
  const lo = UMBRAL_TABLE[i] ?? [0, 0, 0];
  const hi = UMBRAL_TABLE[Math.min(UMBRAL_TABLE_SIZE - 1, i + 1)] ?? lo;
  return [lo[0] + (hi[0] - lo[0]) * t, lo[1] + (hi[1] - lo[1]) * t, lo[2] + (hi[2] - lo[2]) * t];
}

/**
 * Sunlight reaching a point near Earth (Earth at the origin), RGB relative to unobstructed
 * sunlight: the visible part of the Sun's disc past Earth's shadow sphere, plus light refracted
 * through Earth's atmosphere into the shadow.
 */
export function lunarEclipseLightAt(point: Vec3, sunKm: Vec3): Rgb {
  const sun: Sphere = { center: sunKm, radius: SUN_RADIUS_KM };
  const direct = visibleSolarFraction(point, sun, EARTH_SHADOW);
  const { r, umbra } = shadowPosition(point, sun, EARTH_SHADOW);
  // Refraction only acts behind Earth (the anti-Sun side).
  const behind = dot(point, sunKm) < 0;
  const [rr, gg, bb] = behind && umbra > 0 ? umbralLight(r / umbra) : [0, 0, 0];
  return [direct + rr, direct + gg, direct + bb];
}

const luminance = ([r, g, b]: Rgb): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Sample points across the Moon's Earth-facing disc (unit disc, uniform in area). */
const DISC_SAMPLES: readonly [number, number][] = (() => {
  const out: [number, number][] = [];
  const rings = 5;
  for (let i = 0; i < rings; i++) {
    const r = Math.sqrt((i + 0.5) / rings);
    const n = 6 * i + 6;
    for (let j = 0; j < n; j++) {
      const a = (2 * Math.PI * (j + 0.5)) / n;
      out.push([r * Math.cos(a), r * Math.sin(a)]);
    }
  }
  return out;
})();

export interface LunarEclipseIllumination {
  /** Mean luminance factor over the Moon's Earth-facing disc: scales moonlight (1 = no eclipse). */
  readonly mean: number;
  /** Brightest point on that disc: what an auto-exposing camera would normalise to. */
  readonly max: number;
}

export const NO_ECLIPSE: LunarEclipseIllumination = { mean: 1, max: 1 };

/**
 * How eclipsed the Moon looks from Earth: luminance of its sunlight (direct + refracted) averaged
 * over, and maximal across, its Earth-facing disc. Early-out well outside the penumbra.
 */
export function lunarEclipseIllumination(state: SystemState): LunarEclipseIllumination {
  const eclipse = lunarEclipseState(state);
  // The refracted glow reaches ~1.4 umbra radii; it never reaches beyond the penumbra.
  if (eclipse.kind === 'none' && eclipse.penumbralMagnitude < -0.5) return NO_ECLIPSE;
  const towardEarth = normalize(scale(state.moon, -1));
  const helper = Math.abs(towardEarth.z) < 0.9 ? vec(0, 0, 1) : vec(1, 0, 0);
  const e1 = normalize(cross(towardEarth, helper));
  const e2 = cross(towardEarth, e1);
  const k = MOON_RADIUS_KM;
  let sum = 0;
  let max = 0;
  for (const [x, y] of DISC_SAMPLES) {
    const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
    const point = vec(
      state.moon.x + k * (e1.x * x + e2.x * y + towardEarth.x * z),
      state.moon.y + k * (e1.y * x + e2.y * y + towardEarth.y * z),
      state.moon.z + k * (e1.z * x + e2.z * y + towardEarth.z * z),
    );
    const l = luminance(lunarEclipseLightAt(point, state.sun));
    sum += l;
    max = Math.max(max, l);
  }
  return { mean: sum / DISC_SAMPLES.length, max };
}

/** The Moon's mean eclipse dimming as seen from Earth (1 outside eclipses, ~1e-4 mid-totality). */
export const lunarEclipseDimming = (state: SystemState): number =>
  lunarEclipseIllumination(state).mean;

/** Eclipse lighting inputs for one view: geocentric km, expressed in that view's world axes. */
export interface EclipseGeometry {
  readonly moonCenterKm: Vec3;
  readonly sunKm: Vec3;
}

export const eclipseGeometry = (state: SystemState, eqjToWorld: Mat3): EclipseGeometry => ({
  moonCenterKm: mulVec(eqjToWorld, state.moon),
  sunKm: mulVec(eqjToWorld, state.sun),
});

const MAX_DISPLAY_GAIN = 1e4;

/**
 * Display gain for the Moon during an eclipse, like a camera's auto-exposure: normalise to the
 * brightest point on its disc, so an eclipsed Moon shows its colours instead of going black.
 * `compression` < 1 keeps part of the true dimming (the sky view's Moon uses 0.75). 1 outside
 * eclipses. Display choice only.
 */
export function eclipseDisplayGain(
  illumination: LunarEclipseIllumination,
  compression = 1,
): number {
  const gain = 1 / Math.max(illumination.max, 1e-12) ** compression;
  return Math.min(MAX_DISPLAY_GAIN, Math.max(1, gain));
}
