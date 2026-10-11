import { Body, Illumination } from 'astronomy-engine';

/**
 * Moonlight for the sky view, from our ephemeris (astronomy-engine magnitudes). Everything here is
 * relative to sunlight outside the atmosphere, so the atmosphere renderer can reuse its sunlight
 * model with the Moon as the light source, scaled by `lunarToSolarRatio`.
 */

/** Brightness ratio of two sources from their apparent magnitudes. */
export const magnitudeRatio = (mag: number, referenceMag: number): number =>
  10 ** (-0.4 * (mag - referenceMag));

const MINUTE_MS = 60_000;
let cache: { minute: number; ratio: number } | null = null;

/**
 * Illuminance from the Moon at Earth relative to the Sun's, outside the atmosphere:
 * 10^(−0.4 (m_moon − m_sun)), ≈ 2.4e-6 at full Moon, falling steeply toward new Moon.
 *
 * Two Illumination() calls cost tens of microseconds; the ratio changes slowly (phase ~0.5°/h),
 * so it is cached per sim-minute.
 */
export function lunarToSolarRatio(time: Date): number {
  const minute = Math.floor(time.getTime() / MINUTE_MS);
  if (cache?.minute === minute) return cache.ratio;
  const ratio = magnitudeRatio(Illumination(Body.Moon, time).mag, Illumination(Body.Sun, time).mag);
  cache = { minute, ratio };
  return ratio;
}

/** Kasten & Young (1989) relative airmass; finite down to the horizon. */
export function airmass(altitudeDeg: number): number {
  const h = Math.max(0, altitudeDeg);
  return 1 / (Math.sin((h * Math.PI) / 180) + 0.50572 * (h + 6.07995) ** -1.6364);
}

/** Visual-band extinction for a clear, low-altitude site, magnitudes per airmass. */
const EXTINCTION_MAG_PER_AIRMASS = 0.2;

/** Fraction of light surviving the atmosphere from a source at this altitude (0 below horizon). */
export function atmosphericTransmittance(altitudeDeg: number): number {
  if (altitudeDeg < 0) return 0;
  return 10 ** (-0.4 * EXTINCTION_MAG_PER_AIRMASS * airmass(altitudeDeg));
}

/**
 * Direct moonlight on flat ground, relative to an overhead Sun outside the atmosphere:
 * ratio × transmittance × sin(altitude). Zero with the Moon below the horizon.
 * Used for eye adaptation only — the rendered moonlight comes from the atmosphere model itself.
 */
export function moonlightOnGround(ratio: number, moonAltitudeDeg: number): number {
  const sinAlt = Math.sin((moonAltitudeDeg * Math.PI) / 180);
  return ratio * atmosphericTransmittance(moonAltitudeDeg) * Math.max(0, sinAlt);
}

/** Direct moonlight from a full Moon 60° up: the reference for "brightly moonlit". */
export const BRIGHT_MOONLIGHT = moonlightOnGround(2.4e-6, 60);

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * Scale for the sky shader's second, Moon-lit atmosphere evaluation: the lunar/solar ratio, faded
 * out as the Moon sinks below −4° (its scattered light is negligible by then) and while the Sun is
 * above −4° (moonlight is < 0.1% of twilight there). Both fades only skip GPU work whose result
 * would be invisible; neither changes what a moonlit night looks like.
 */
export function moonSkyLightScale(
  ratio: number,
  moonAltitudeDeg: number,
  sunAltitudeDeg: number,
): number {
  return ratio * smoothstep(-6, -4, moonAltitudeDeg) * smoothstep(-2, -4, sunAltitudeDeg);
}

/**
 * Scale for the Sun's own scattering in the sky shader. Astronomical night begins at −18° by
 * definition of the Sun no longer lighting the sky; the precomputed scattering tables stop well
 * above that and would otherwise leave a faint constant glow, which the higher moonlit-night
 * exposure would reveal.
 */
export function sunSkyLightScale(sunAltitudeDeg: number): number {
  return 1 - smoothstep(-15, -18, sunAltitudeDeg);
}
