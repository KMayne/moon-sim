/**
 * Low-light colour perception (the Purkinje shift), applied per pixel before exposure.
 *
 * In dim light the eye's rods take over from the cones. Rods are colour-blind and peak in the
 * blue-green, so dim scenes look desaturated, slightly blue, with reds darkening relative to blues.
 * This follows Jensen et al. 2000 ("A Physically-Based Night Sky Model"):
 * - scotopic luminance from CIE XYZ via Larson et al. 1997: V = Y·(1.33·(1 + (Y+Z)/X) − 1.68),
 *   normalised here so D65 white keeps its luminance;
 * - a mesopic weight s from the pixel's absolute luminance: 0 (photopic, full colour) above
 *   10^0.6 ≈ 4 cd/m², 1 (scotopic) below 10^−2 = 0.01 cd/m², smoothstep in log luminance between;
 * - rod vision rendered as V times a slightly blue tint (Jensen's blue shift).
 *
 * Inputs are linear Rec.709/sRGB primaries. A display-perception choice, like eye adaptation:
 * it never touches positions, timing or the physics of the light itself.
 */

/** log10 cd/m² at and above which vision is fully photopic. */
export const PHOTOPIC_LOG_LUMINANCE = 0.6;
/** log10 cd/m² at and below which vision is fully scotopic. */
export const SCOTOPIC_LOG_LUMINANCE = -2;

/** Jensen et al.'s blue shift for scotopic vision, scaled to unit Rec.709 luminance. */
export const SCOTOPIC_TINT: readonly [number, number, number] = (() => {
  const raw = [1.05, 0.97, 1.27] as const;
  const y = 0.2126 * raw[0] + 0.7152 * raw[1] + 0.0722 * raw[2];
  return [raw[0] / y, raw[1] / y, raw[2] / y];
})();

type Rgb = readonly [number, number, number];

/** Linear Rec.709 → CIE XYZ (D65). */
export function rgbToXyz([r, g, b]: Rgb): [number, number, number] {
  return [
    0.4124 * r + 0.3576 * g + 0.1805 * b,
    0.2126 * r + 0.7152 * g + 0.0722 * b,
    0.0193 * r + 0.1192 * g + 0.9505 * b,
  ];
}

/** Larson's V for D65 white (X=0.9505, Y=1, Z=1.089); dividing by it keeps white's luminance. */
const WHITE_SCOTOPIC_RATIO = 1.33 * (1 + (1 + 1.089) / 0.9505) - 1.68;

/** Scotopic luminance in the same units as Y, normalised so D65 white is unchanged. */
export function scotopicLuminance(rgb: Rgb): number {
  const [x, y, z] = rgbToXyz(rgb);
  if (x <= 0 || y <= 0) return 0;
  return Math.max(0, (y * (1.33 * (1 + (y + z) / x) - 1.68)) / WHITE_SCOTOPIC_RATIO);
}

/** Mesopic weight: 0 = all cones (full colour), 1 = all rods. */
export function scotopicWeight(luminanceCdM2: number): number {
  if (!(luminanceCdM2 > 0)) return 1;
  const t =
    (PHOTOPIC_LOG_LUMINANCE - Math.log10(luminanceCdM2)) /
    (PHOTOPIC_LOG_LUMINANCE - SCOTOPIC_LOG_LUMINANCE);
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/**
 * Perceived linear colour for a pixel. `rgb` is linear radiance in any unit; `cdM2PerUnit` converts
 * its Rec.709 luminance to cd/m².
 */
export function mesopicColor(rgb: Rgb, cdM2PerUnit: number): [number, number, number] {
  const y = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const s = scotopicWeight(y * cdM2PerUnit);
  const v = scotopicLuminance(rgb);
  return [
    (1 - s) * rgb[0] + s * v * SCOTOPIC_TINT[0],
    (1 - s) * rgb[1] + s * v * SCOTOPIC_TINT[1],
    (1 - s) * rgb[2] + s * v * SCOTOPIC_TINT[2],
  ];
}

const glslFloat = (n: number): string => (Number.isInteger(n) ? `${n}.0` : `${n}`);

/** GLSL twin of `mesopicColor`, generated from the same constants. Uniform: moonSimCdM2PerUnit. */
export const MESOPIC_GLSL = /* glsl */ `
uniform float moonSimCdM2PerUnit;

vec3 moonSimMesopic(vec3 rgb) {
  float y = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 xyz = mat3(
    vec3(0.4124, 0.2126, 0.0193),
    vec3(0.3576, 0.7152, 0.1192),
    vec3(0.1805, 0.0722, 0.9505)
  ) * rgb;
  float v = (xyz.x > 0.0 && xyz.y > 0.0)
    ? max(0.0, xyz.y * (1.33 * (1.0 + (xyz.y + xyz.z) / xyz.x) - 1.68) / ${glslFloat(WHITE_SCOTOPIC_RATIO)})
    : 0.0;
  float logL = log(max(y * moonSimCdM2PerUnit, 1e-12)) / log(10.0);
  float c = clamp(
    (${glslFloat(PHOTOPIC_LOG_LUMINANCE)} - logL) /
      (${glslFloat(PHOTOPIC_LOG_LUMINANCE - SCOTOPIC_LOG_LUMINANCE)}),
    0.0, 1.0
  );
  float s = c * c * (3.0 - 2.0 * c);
  vec3 tint = vec3(${SCOTOPIC_TINT.map(glslFloat).join(', ')});
  return mix(rgb, v * tint, s);
}
`;
