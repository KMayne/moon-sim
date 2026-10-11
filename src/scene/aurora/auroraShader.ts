/**
 * Cosmetic aurora curtain. Display-referred output (already "tone mapped"): the aurora is only
 * drawn once the sky view is night-adapted, so it is calibrated for that state directly rather
 * than pushed through the physical-radiance exposure path. Peak values stay well below 1 so
 * stars still show through the additive blend.
 */
export const auroraVertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const auroraFragmentShader = /* glsl */ `
uniform float uTime;
uniform float uIntensity;
varying vec2 vUv;

float hash(float n) { return fract(sin(n) * 43758.5453123); }

float noise(float x) {
  float i = floor(x);
  float f = fract(x);
  float s = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), s);
}

float fbm(float x) {
  float v = 0.0;
  float a = 0.5;
  for (int k = 0; k < 4; k++) {
    v += a * noise(x);
    x *= 2.13;
    a *= 0.5;
  }
  return v;
}

void main() {
  float t = uTime;
  float u = vUv.x;
  float v = vUv.y;

  // The curtain's lower edge undulates: folds drift slowly sideways.
  float fold = fbm(u * 6.0 + t * 0.05) * 0.35 + fbm(u * 17.0 - t * 0.08) * 0.1;
  float base = 0.05 + fold * 0.45;
  float h = v - base;

  // Fine vertical rays that shimmer.
  float rays = 0.55 + 0.45 * fbm(u * 140.0 + fold * 8.0 + t * 0.6);
  // Bright, sharp lower border fading upwards.
  // A soft glow just below it, so the edge doesn't read as a black skyline.
  float profile = h >= 0.0
    ? (0.25 + 0.75 * smoothstep(0.0, 0.03, h)) * exp(-h * 3.2)
    : 0.25 * exp(h * 18.0);
  // Fade at the azimuth ends and the top of the band.
  float edges = smoothstep(0.0, 0.18, u) * smoothstep(1.0, 0.82, u) * smoothstep(1.0, 0.7, v);
  // Slow overall breathing.
  float pulse = 0.75 + 0.25 * sin(t * 0.3 + u * 4.0);

  float strength = profile * rays * edges * pulse * uIntensity;
  // 557.7 nm oxygen green low down; faint red/purple higher up.
  vec3 green = vec3(0.12, 0.85, 0.42);
  vec3 upper = vec3(0.55, 0.15, 0.45);
  vec3 color = mix(green, upper, smoothstep(0.15, 0.6, h));
  gl_FragColor = vec4(color * strength * 0.45, 1.0);
}
`;
