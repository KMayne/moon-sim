import { MOON_RADIUS_KM, SUN_RADIUS_KM } from '../astro/constants';
import type { SystemState } from '../astro/ephemeris';
import { observerEcefKm, type Geodetic } from '../astro/observer';
import { mulVec, type Vec3 } from '../astro/vec';
import { visibleSolarFraction, type Sphere } from './eclipse';

/**
 * Solar eclipses: the Moon as the occluder in sim/eclipse.ts's generic geometry. Geocentric EQJ km
 * throughout (Earth at the origin).
 */

const sunSphere = (state: SystemState): Sphere => ({ center: state.sun, radius: SUN_RADIUS_KM });
const moonSphere = (state: SystemState): Sphere => ({ center: state.moon, radius: MOON_RADIUS_KM });

/** Fraction of the Sun's disc visible from a point (geocentric EQJ km) past the Moon. */
export const solarFractionAt = (state: SystemState, pointEqjKm: Vec3): number =>
  visibleSolarFraction(pointEqjKm, sunSphere(state), moonSphere(state));

/** The observer's position, geocentric EQJ km (WGS 84 surface point). */
export const observerEqjKm = (state: SystemState, observer: Geodetic): Vec3 =>
  mulVec(state.earthOrientation, observerEcefKm(observer));

/** Fraction of the Sun's disc the observer can see (1 = no eclipse, 0 = totality). */
export const observerSolarFraction = (state: SystemState, observer: Geodetic): number =>
  solarFractionAt(state, observerEqjKm(state, observer));

/**
 * Sky light left at totality, relative to the uneclipsed sky. Inside the Moon's ~100–250 km umbra
 * the sky is lit only by light scattered in from the sunlit atmosphere outside it; observed sky
 * brightness at totality is roughly 10⁻⁴–10⁻³ of daylight (like deep civil to nautical twilight).
 * The precomputed scattering can't produce that light itself (it's all sunlight scattered toward
 * us from inside the shadow), so the sky shader adds it as a separate, nearly uniform term: the
 * daylight sky's mean radiance × this residual, brighter and warmer toward the horizon (the 360°
 * "sunset"), with no aureole around the hidden Sun. An approximation of a multiple-scattering
 * effect; its strength and horizon profile are typical values, not computed.
 */
export const TOTALITY_SKY_RESIDUAL = 3e-4;

/** Weight of that residual term for a visible fraction (0 outside eclipses). */
export const totalityResidual = (visibleFraction: number): number =>
  TOTALITY_SKY_RESIDUAL * (1 - visibleFraction);

/** Overall scale on the Sun's light, for the eye's adaptation: direct part + residual. */
export const eclipseSunlightScale = (visibleFraction: number): number =>
  visibleFraction + totalityResidual(visibleFraction);

/**
 * The corona is always there (total brightness ~10⁻⁶ of the Sun, about a full Moon) but drowns in
 * the glare of even a sliver of photosphere; it shows only near totality. 0 → 1 as the visible
 * fraction falls from 10⁻³ to 10⁻⁵. Approximation of glare, not a physical threshold.
 */
export function coronaWeight(visibleFraction: number): number {
  const lo = Math.log10(1e-5);
  const hi = Math.log10(1e-3);
  const x = Math.log10(Math.max(visibleFraction, 1e-12));
  const t = Math.min(1, Math.max(0, (hi - x) / (hi - lo)));
  return t * t * (3 - 2 * t);
}

/**
 * Corona radiance model: L(θ) = Lsun · K · (R/θ)ⁿ outside the solar limb (θ > R). Its total flux
 * is 2K/(n−2) of the Sun's; with n = 5 (the inner K-corona falls off steeply, ~r⁻⁵…⁻⁶) and
 * K = 1.5×10⁻⁶ that's ~10⁻⁶ — about a full Moon — concentrated within a few solar radii, as seen by
 * eye. Real coronae are streamered and vary with the solar cycle.
 */
export const CORONA_FALLOFF = 5;
export const CORONA_K = 1.5e-6;

/** Corona flux relative to the Sun's (integral of the model above). */
export const coronaFlux = (): number => (2 * CORONA_K) / (CORONA_FALLOFF - 2);
