/**
 * Light inside Earth's umbra during a lunar eclipse: sunlight refracted through Earth's limb.
 *
 * Every ray that grazes Earth at tangent altitude h is bent toward the shadow axis by the
 * atmosphere and dimmed and reddened along its long, horizontal path — the light of every sunrise
 * and sunset on Earth at once. We trace that geometrically (small angles, spherical Earth):
 *
 * - refraction: total bending of a tangent ray through an exponential atmosphere,
 *   δ(h) = N₀·e^(−h/H)·√(2π(R+h)/H)  (≈ 1.2° at sea level, i.e. twice the ~35′ horizontal
 *   refraction we see at sunset);
 * - transmittance: takram's precomputed Bruneton transmittance (the same tables the sky view
 *   renders with), squared because the tangent path runs from the top of the atmosphere down to
 *   altitude h and back out again. It carries Rayleigh, aerosol (Mie) and ozone absorption — the
 *   ozone is what gives the umbra's edge its turquoise fringe;
 * - clouds/terrain: the lowest rays are partly blocked; `clearFraction` ramps from 0.3 at the
 *   surface to clear sky by 12 km. This is the main uncertainty in any eclipse's brightness (the
 *   Danjon scale); these values aim at a typical L ≈ 2–3 eclipse;
 * - focusing: the ray bundles from every point of the Sun's disc land as rings on a plane at the
 *   Moon's mean distance; flux per area there, relative to unobstructed sunlight, is the result.
 *
 * Ignored: the oblateness of Earth, seasonal/latitudinal variation of the atmosphere, extra path
 * length from bending, solar limb darkening, volcanic aerosols. Output is a lookup of RGB vs
 * x = (distance from the shadow axis) / (umbra radius), precomputed offline into
 * umbralLight.table.ts (a test regenerates it from the self-hosted transmittance and checks it).
 */

/** Mean Earth radius (km), as astronomy-engine uses for eclipses. */
export const EARTH_MEAN_RADIUS_KM = 6371;
/**
 * Effective shadow radius: rays below this are bent/absorbed out of the geometric shadow edge.
 * 6371 + 88 km, astronomy-engine's value (matches the observed ~2% enlargement of the umbra).
 */
export const EARTH_SHADOW_RADIUS_KM = 6459;

const MEAN_MOON_DISTANCE_KM = 384_400;
const SUN_DISTANCE_KM = 149_597_871;
const SUN_RADIUS_KM = 695_700;

/** Sea-level refractivity (n − 1) and its scale height. */
const REFRACTIVITY = 2.8e-4;
const REFRACTIVITY_SCALE_HEIGHT_KM = 7.5;

/** Lookup extent: rays from the top of the shadow atmosphere land up to ~1.4 umbra radii out. */
export const UMBRAL_TABLE_MAX_X = 1.5;
export const UMBRAL_TABLE_SIZE = 48;

export type Rgb = readonly [number, number, number];

/** Total bending (rad) of a ray grazing Earth at tangent altitude h (km). */
export function refractionBending(hKm: number): number {
  const h = REFRACTIVITY_SCALE_HEIGHT_KM;
  return (
    REFRACTIVITY * Math.exp(-hKm / h) * Math.sqrt((2 * Math.PI * (EARTH_MEAN_RADIUS_KM + hKm)) / h)
  );
}

/** Fraction of grazing rays at altitude h not blocked by cloud or terrain (typical eclipse). */
export function clearFraction(hKm: number): number {
  const t = Math.min(1, Math.max(0, hKm / 12));
  return 0.3 + 0.7 * t * t * (3 - 2 * t);
}

/** Umbra radius (km) at distance `d` behind Earth (astronomy-engine's cone, Sun at mean distance). */
export function umbraRadiusAtKm(dKm: number): number {
  const u = dKm / SUN_DISTANCE_KM;
  return SUN_RADIUS_KM - (1 + u) * (SUN_RADIUS_KM - EARTH_SHADOW_RADIUS_KM);
}

/**
 * Builds the lookup: refracted irradiance (relative to unobstructed sunlight, per RGB channel) at
 * x = ρ / umbra radius, at the Moon's mean distance.
 *
 * @param halfPathTransmittance Transmittance from tangent altitude h (km) horizontally out of the
 *   atmosphere, RGB. The full tangent path is its square.
 */
export function computeUmbralTable(halfPathTransmittance: (hKm: number) => Rgb): Rgb[] {
  const d = MEAN_MOON_DISTANCE_KM;
  const k = umbraRadiusAtKm(d);
  const binWidth = UMBRAL_TABLE_MAX_X / UMBRAL_TABLE_SIZE;
  const sums = Array.from({ length: UMBRAL_TABLE_SIZE }, () => [0, 0, 0]);

  // Rays through the shadow atmosphere only: higher rays are treated as direct sunlight.
  const H_MAX = EARTH_SHADOW_RADIUS_KM - EARTH_MEAN_RADIUS_KM;
  const H_STEP = 0.1;
  const rays: { rho: number; weight: Rgb }[] = [];
  for (let h = H_STEP / 2; h < H_MAX; h += H_STEP) {
    const b = EARTH_MEAN_RADIUS_KM + h;
    const t = halfPathTransmittance(h);
    const c = clearFraction(h);
    // Area of this impact annulus (per radian of azimuth), times what survives the path.
    const area = b * H_STEP;
    rays.push({
      rho: b - d * refractionBending(h),
      weight: [t[0] ** 2 * c * area, t[1] ** 2 * c * area, t[2] ** 2 * c * area],
    });
  }

  // Points across the Sun's disc (uniform in area); each shifts the whole ray pattern by d·s.
  const sunAngle = SUN_RADIUS_KM / SUN_DISTANCE_KM;
  const sunPoints: number[] = [];
  const RINGS = 8;
  for (let i = 0; i < RINGS; i++) {
    const r = sunAngle * Math.sqrt((i + 0.5) / RINGS);
    const n = 4 * i + 4;
    for (let j = 0; j < n; j++) sunPoints.push(d * r); // offset magnitude; azimuth folds into φ
  }
  const PHI_STEPS = 256;
  const dPhi = (2 * Math.PI) / PHI_STEPS;

  for (const c of sunPoints) {
    for (const { rho, weight } of rays) {
      for (let j = 0; j < PHI_STEPS; j++) {
        const phi = (j + 0.5) * dPhi;
        // Landing point: ring of radius ρ (ρ < 0 means the ray crossed the axis) about an
        // offset centre c — the radial distance from the true axis.
        const q = Math.sqrt(rho * rho + c * c + 2 * rho * c * Math.cos(phi));
        const bin = Math.floor(q / k / binWidth);
        const sum = sums[bin];
        if (!sum) continue;
        sum[0] = (sum[0] ?? 0) + weight[0] * dPhi;
        sum[1] = (sum[1] ?? 0) + weight[1] * dPhi;
        sum[2] = (sum[2] ?? 0) + weight[2] * dPhi;
      }
    }
  }

  return sums.map((sum, i) => {
    const inner = i * binWidth * k;
    const outer = (i + 1) * binWidth * k;
    const area = Math.PI * (outer * outer - inner * inner) * sunPoints.length;
    return [(sum[0] ?? 0) / area, (sum[1] ?? 0) / area, (sum[2] ?? 0) / area] as const;
  });
}
