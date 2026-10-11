/**
 * Eye adaptation for the sky view. The atmosphere renderer outputs physical radiance, which spans
 * ~4 orders of magnitude from day to astronomical night; a fixed exposure shows either a blank
 * night or a blown-out day. We adapt like an eye does, keyed to the Sun's altitude: daylight
 * exposure at and above the horizon, rising log-linearly through twilight to night-adapted at the
 * end of astronomical twilight (−18°).
 *
 * Purely a display choice: it changes brightness on screen, never any position or timing.
 */
const DAY_LOG_EXPOSURE = 1; // ×10
const NIGHT_LOG_EXPOSURE = 4; // ×10,000
const ASTRONOMICAL_TWILIGHT_END_DEG = -18;

export function skyExposure(sunAltitudeDeg: number): number {
  const t = Math.min(1, Math.max(0, sunAltitudeDeg / ASTRONOMICAL_TWILIGHT_END_DEG));
  // Smoothstep so adaptation eases in and out rather than kinking at sunset and at −18°.
  const s = t * t * (3 - 2 * t);
  return 10 ** (DAY_LOG_EXPOSURE + s * (NIGHT_LOG_EXPOSURE - DAY_LOG_EXPOSURE));
}

/**
 * Star brightness relative to the sky's radiance units. With daylight exposure the brightest star
 * renders far below the daytime sky (invisible, as in reality); night-adapted, magnitude ~6 stars
 * are just visible.
 */
export const STAR_INTENSITY = 0.01;
