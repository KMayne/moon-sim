import { BRIGHT_MOONLIGHT } from './moonlight';

/**
 * Eye adaptation for the sky view. The atmosphere renderer outputs physical radiance, which spans
 * ~10 orders of magnitude from day to a moonlit night; a fixed exposure shows either a blank night
 * or a blown-out day. We adapt like an eye does:
 *
 * - Sun: daylight exposure at and above the horizon, rising log-linearly through twilight to the
 *   night level at the end of astronomical twilight (−18°).
 * - Moon: on a moonless night the night level shows stars and the night floor and nothing else
 *   (the model has no airglow). When the Moon lights the scene the eye adapts to moonlight — a
 *   million times dimmer than day — so exposure rises further, compressively: a full Moon lights
 *   the ground clearly, a crescent dimly, and the boost fades out as moonlight vanishes so a
 *   moonless night is unchanged.
 *
 * Purely a display choice: it changes brightness on screen, never any position or timing.
 */
const DAY_LOG_EXPOSURE = 1; // ×10
const NIGHT_LOG_EXPOSURE = 4; // ×10,000
const ASTRONOMICAL_TWILIGHT_END_DEG = -18;

/** Night-level exposure (no moonlight). Stars are calibrated against it. */
export const NIGHT_EXPOSURE = 10 ** NIGHT_LOG_EXPOSURE;

/** Exposure when lit by BRIGHT_MOONLIGHT (full Moon 60° up). */
const BRIGHT_MOON_LOG_EXPOSURE = 5.3;
/**
 * How much of a change in moonlight the eye compensates (0 = none, 1 = all). Perceived brightness
 * then follows moonlight^(1 − this), a Stevens-like compression.
 */
const MOON_ADAPTATION = 0.5;
/** Moonlight (relative to bright moonlight) below which the scene counts as moonless, in log10. */
const MOONLESS_LOG = -3;
const MOONLIT_LOG = -1.5;
/** Ceiling, so a sliver of Moon never drives exposure into the shader's numerical noise. */
const MAX_LOG_EXPOSURE = 6.5;

const smoothstep01 = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** 0 with the Sun up, 1 from the end of astronomical twilight. */
export function nightWeight(sunAltitudeDeg: number): number {
  return smoothstep01(sunAltitudeDeg / ASTRONOMICAL_TWILIGHT_END_DEG);
}

/** Extra log10 exposure from moonlight on the ground (see sim/moonlight.ts), before night weighting. */
export function moonExposureBoost(moonlight: number): number {
  if (!(moonlight > 0)) return 0;
  const x = Math.log10(moonlight / BRIGHT_MOONLIGHT);
  const moonLog = Math.min(MAX_LOG_EXPOSURE, BRIGHT_MOON_LOG_EXPOSURE - MOON_ADAPTATION * x);
  const presence = smoothstep01((x - MOONLESS_LOG) / (MOONLIT_LOG - MOONLESS_LOG));
  return presence * Math.max(0, moonLog - NIGHT_LOG_EXPOSURE);
}

/**
 * @param sunAltitudeDeg Sun's altitude for the observer.
 * @param moonlight Direct moonlight on the ground, relative to an overhead Sun outside the
 *   atmosphere (sim/moonlight.ts `moonlightOnGround`). 0 = moonless.
 */
export function skyExposure(sunAltitudeDeg: number, moonlight = 0): number {
  const night = nightWeight(sunAltitudeDeg);
  const sunLog = DAY_LOG_EXPOSURE + night * (NIGHT_LOG_EXPOSURE - DAY_LOG_EXPOSURE);
  return 10 ** (sunLog + night * moonExposureBoost(moonlight));
}

/**
 * Exposure for the stars: follows the sky through twilight but never exceeds the night level they
 * were calibrated for. On a moonlit night the moonlit sky brightens around them while they don't,
 * so the faint ones drown — as they do outdoors.
 */
export const starExposure = (exposure: number): number => Math.min(exposure, NIGHT_EXPOSURE);

/**
 * Star brightness relative to the sky's radiance units. With daylight exposure the brightest star
 * renders far below the daytime sky (invisible, as in reality); night-adapted, magnitude ~6 stars
 * are just visible.
 */
export const STAR_INTENSITY = 0.01;
