/**
 * When the cosmetic aurora is drawn. This is flair, not a simulation: real aurorae depend on solar
 * wind and geomagnetic latitude, neither of which this app models. The rule only keeps it where an
 * aurora is plausible to see:
 * - far enough north (northern hemisphere only — the curtain sits on the northern horizon), and
 * - dark enough: fades in as the Sun sinks from −6° (end of civil twilight) to −12° (nautical).
 */
export const AURORA_MIN_LATITUDE_DEG = 60;
const FADE_START_SUN_ALT_DEG = -6;
const FULL_SUN_ALT_DEG = -12;

/** Overall aurora intensity, 0–1. */
export function auroraIntensity(latitudeDeg: number, sunAltitudeDeg: number): number {
  if (latitudeDeg < AURORA_MIN_LATITUDE_DEG) return 0;
  const t = (FADE_START_SUN_ALT_DEG - sunAltitudeDeg) / (FADE_START_SUN_ALT_DEG - FULL_SUN_ALT_DEG);
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

export type AuroraStatus = 'visible' | 'too-far-south' | 'not-dark';

/** Why the aurora is or isn't showing, for an honest UI hint. Fading in counts as visible. */
export function auroraStatus(latitudeDeg: number, sunAltitudeDeg: number): AuroraStatus {
  if (latitudeDeg < AURORA_MIN_LATITUDE_DEG) return 'too-far-south';
  return auroraIntensity(latitudeDeg, sunAltitudeDeg) > 0 ? 'visible' : 'not-dark';
}

export const AURORA_RULE_TEXT = `Aurora shows only north of ${AURORA_MIN_LATITUDE_DEG}°N when the Sun is below −12°.`;
