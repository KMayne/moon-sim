import { MOON_RADIUS_KM, SUN_RADIUS_KM } from '../astro/constants';
import { EARTH_SHADOW_RADIUS_KM, UMBRAL_TABLE_MAX_X, UMBRAL_TABLE_SIZE } from './umbralLight';
import { UMBRAL_TABLE } from './umbralLight.table';

const f = (n: number): string => {
  const s = String(n);
  return /[.eE]/.test(s) ? s : `${s}.0`;
};

/**
 * GLSL twin of sim/eclipse.ts, generated from the same constants. Generic occlusion
 * (`moonSimVisibleSolarFraction`) plus Earth's shadow with refracted light
 * (`moonSimLunarEclipseLight`, Earth at the origin). Positions in km, any consistent axes.
 *
 * Precision: geocentric km in float32 keeps ~10 km absolute error at the Sun's distance — far below
 * the ~6,000 km scale of the shadow — and ~0.03 km at the Moon's.
 */
export const ECLIPSE_GLSL = /* glsl */ `
#ifndef MOON_SIM_ECLIPSE
#define MOON_SIM_ECLIPSE
const float MOON_SIM_SUN_RADIUS_KM = ${f(SUN_RADIUS_KM)};
const float MOON_SIM_MOON_RADIUS_KM = ${f(MOON_RADIUS_KM)};
const float MOON_SIM_EARTH_SHADOW_RADIUS_KM = ${f(EARTH_SHADOW_RADIUS_KM)};
const float MOON_SIM_UMBRAL_MAX_X = ${f(UMBRAL_TABLE_MAX_X)};
const int MOON_SIM_UMBRAL_SIZE = ${String(UMBRAL_TABLE_SIZE)};
const vec3 MOON_SIM_UMBRAL[${String(UMBRAL_TABLE_SIZE)}] = vec3[${String(UMBRAL_TABLE_SIZE)}](
  ${UMBRAL_TABLE.map((c) => `vec3(${c.map(f).join(', ')})`).join(',\n  ')}
);

float moonSimAngleBetween(vec3 a, vec3 b) {
  return atan(length(cross(a, b)), dot(a, b));
}

// Fraction of a disc (angular radius a) covered by a disc of radius b at separation d.
float moonSimDiscCovered(float a, float b, float d) {
  if (d >= a + b) return 0.0;
  if (d <= b - a) return 1.0;
  if (d <= a - b) return (b * b) / (a * a);
  float alpha = acos(clamp((d * d + a * a - b * b) / (2.0 * d * a), -1.0, 1.0));
  float beta = acos(clamp((d * d + b * b - a * a) / (2.0 * d * b), -1.0, 1.0));
  float k = max(0.0, (-d + a + b) * (d + a - b) * (d - a + b) * (d + a + b));
  float lens = a * a * alpha + b * b * beta - 0.5 * sqrt(k);
  return clamp(lens / (3.14159265 * a * a), 0.0, 1.0);
}

// Fraction of the Sun's disc visible from p past an occluding sphere.
float moonSimVisibleSolarFraction(vec3 p, vec3 sunCenter, float sunRadius, vec3 occCenter, float occRadius) {
  vec3 toSun = sunCenter - p;
  vec3 toOcc = occCenter - p;
  float occDistance = length(toOcc);
  if (occDistance <= occRadius) return 0.0;
  float a = asin(min(1.0, sunRadius / length(toSun)));
  float b = asin(min(1.0, occRadius / occDistance));
  return 1.0 - moonSimDiscCovered(a, b, moonSimAngleBetween(toSun, toOcc));
}

vec3 moonSimUmbralLight(float x) {
  float fi = x / MOON_SIM_UMBRAL_MAX_X * float(MOON_SIM_UMBRAL_SIZE) - 0.5;
  if (x < 0.0 || fi >= float(MOON_SIM_UMBRAL_SIZE) - 0.5) return vec3(0.0);
  int i = int(max(0.0, floor(fi)));
  float t = clamp(fi - float(i), 0.0, 1.0);
  int j = min(MOON_SIM_UMBRAL_SIZE - 1, i + 1);
  return mix(MOON_SIM_UMBRAL[i], MOON_SIM_UMBRAL[j], t);
}

// Sunlight reaching p (Earth at the origin), RGB relative to unobstructed sunlight.
vec3 moonSimLunarEclipseLight(vec3 p, vec3 sunKm) {
  float direct = moonSimVisibleSolarFraction(
    p, sunKm, MOON_SIM_SUN_RADIUS_KM, vec3(0.0), MOON_SIM_EARTH_SHADOW_RADIUS_KM);
  vec3 axis = -sunKm;
  float u = dot(axis, p) / dot(axis, axis);
  float r = length(axis * u - p);
  float umbra = MOON_SIM_SUN_RADIUS_KM - (1.0 + u) * (MOON_SIM_SUN_RADIUS_KM - MOON_SIM_EARTH_SHADOW_RADIUS_KM);
  vec3 refracted = (dot(p, sunKm) < 0.0 && umbra > 0.0) ? moonSimUmbralLight(r / umbra) : vec3(0.0);
  return vec3(direct) + refracted;
}
#endif
`;
