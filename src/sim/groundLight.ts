import type { Vec3 } from '../astro/vec';

/**
 * Albedo of the sky view's generic ground, linear RGB: a neutral, slightly warm soil/vegetation mix
 * (mean ≈ 0.15). Fixed all year — no snow, no seasons.
 */
export const GROUND_ALBEDO: Vec3 = { x: 0.17, y: 0.15, z: 0.12 };

/**
 * Radiance leaving flat Lambertian ground, in the atmosphere renderer's units:
 *   L = albedo / π × (E_sun · max(0, sin(sun altitude)) + E_sky)
 * where E_sun is transmitted sunlight on a surface facing the Sun and E_sky the diffuse sky
 * irradiance on a horizontal surface.
 *
 * The sky view does not call this: takram's sky shader evaluates the same Bruneton term on the GPU
 * (sky.frag, GROUND_ALBEDO branch) so the ground shares the sky's exposure and tone mapping. This CPU
 * mirror exists so tests can check the lighting inputs we feed that shader.
 */
export function groundRadiance(
  albedo: Vec3,
  sunIrradiance: Vec3,
  sunAltitudeDeg: number,
  skyIrradiance: Vec3,
): Vec3 {
  const cosIncidence = Math.max(0, Math.sin((sunAltitudeDeg * Math.PI) / 180));
  const k = (c: 'x' | 'y' | 'z') =>
    (albedo[c] / Math.PI) * (sunIrradiance[c] * cosIncidence + skyIrradiance[c]);
  return { x: k('x'), y: k('y'), z: k('z') };
}

/** Rec. 709 relative luminance of a linear RGB triple. */
export const luminance = (c: Vec3): number => 0.2126 * c.x + 0.7152 * c.y + 0.0722 * c.z;

/**
 * Display-only night floor for the sky view — a perceptual aid like the sky's eye adaptation
 * (sim/skyExposure.ts), not physics. Physically lit ground and the moonless sky near the horizon both
 * render near-black at night, so the horizon would vanish into a void. Once the Sun sets we fade in
 * small display-space (sRGB-encoded, 0–1) floors:
 *   - sky: faint, brighter toward the horizon (as airglow and distant skyglow are);
 *   - ground: dimmer than the sky everywhere, carrying the ground's texture, with a slight lift
 *     toward the horizon — so the horizon reads as a step from brighter sky to darker ground.
 * Stars and the Moon still draw on top of the sky and are hidden by the ground as before.
 */
export interface NightFloor {
  /** Sky floor straight up. */
  readonly skyZenith: number;
  /** Sky floor at the horizon. */
  readonly skyHorizon: number;
  /** Ground floor close to the observer. */
  readonly ground: number;
  /** Ground floor at the horizon (the lift that marks the horizon line). */
  readonly groundHorizon: number;
}

/** Full-strength floors (fully dark sky). Values are sRGB-encoded display levels (×255 ≈ 10–28). */
export const NIGHT_FLOOR_MAX: NightFloor = {
  skyZenith: 0.04,
  skyHorizon: 0.11,
  ground: 0.05,
  groundHorizon: 0.075,
};

/**
 * Floors start at sunset and are complete by the end of nautical twilight. They must start that
 * early: the ACES tone curve crushes radiance below ~0.4% of white to pure black, so twilight-lit
 * ground would otherwise vanish well before the sky darkens.
 */
const FLOOR_START_DEG = 0;
const FLOOR_FULL_DEG = -12;

/** 0 while the Sun is up, easing to 1 by −12° solar altitude. */
export function nightFloorWeight(sunAltitudeDeg: number): number {
  const t = (FLOOR_START_DEG - sunAltitudeDeg) / (FLOOR_START_DEG - FLOOR_FULL_DEG);
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

export function nightFloor(sunAltitudeDeg: number): NightFloor {
  const w = nightFloorWeight(sunAltitudeDeg);
  return {
    skyZenith: NIGHT_FLOOR_MAX.skyZenith * w,
    skyHorizon: NIGHT_FLOOR_MAX.skyHorizon * w,
    ground: NIGHT_FLOOR_MAX.ground * w,
    groundHorizon: NIGHT_FLOOR_MAX.groundHorizon * w,
  };
}
