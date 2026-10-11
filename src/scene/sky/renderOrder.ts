/**
 * Draw order within the sky view (all in three's opaque pass):
 * sky first (no depth write), then the ground (occludes everything below the horizon), then the
 * Moon (additive, writes depth so it hides stars behind it), then stars and overlays.
 */
export const SKY_RENDER_ORDER = {
  sky: -30,
  ground: -20,
  moon: -10,
  stars: 0,
  overlay: 10,
} as const;
