import {
  AddEquation,
  CustomBlending,
  OneFactor,
  ShaderMaterial,
  SrcAlphaFactor,
  Uniform,
  ZeroFactor,
} from 'three';

/**
 * The sky view's ground overlay. The ground's colour is NOT computed here: takram's sky shader, drawn
 * first, already renders the ground physically (Bruneton sun + sky irradiance × albedo/π, with
 * aerial perspective) through the sky's exposure and tone mapping. This material, drawn on the
 * ground plane over it, does three display-side things:
 *   1. writes depth, so the Moon, arcs and stars stop sharply at the horizon;
 *   2. multiplies in a subtle procedural texture (only ever darkens, ≤ ~28%), fading out as
 *      features shrink below a few pixels so the distance never shimmers;
 *   3. adds the display-only night floor (sim/groundLight.ts), lifted toward the horizon, so the
 *      ground stays legible as ground at night.
 * Blend: out = src.rgb + dst.rgb × src.a, with src = (floor × m, m) and m the texture multiplier.
 */

const VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAGMENT = /* glsl */ `
uniform float uFloorNear;
uniform float uFloorHorizon;
uniform float uEyeHeight;
varying vec3 vWorld;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// One octave of feature size s (metres), faded out once a pixel covers a sizeable part of a feature.
float octave(vec2 p, float s, float footprint) {
  float visible = 1.0 - smoothstep(0.15 * s, 0.5 * s, footprint);
  return visible * valueNoise(p / s);
}

const float CONTRAST = 0.28;

void main() {
  vec2 p = vWorld.xz;
  float footprint = length(fwidth(p));
  float horizontal = length(p - cameraPosition.xz);

  float detail =
    0.35 * octave(p, 0.7, footprint) +
    0.30 * octave(p, 3.0, footprint) +
    0.20 * octave(p, 12.0, footprint) +
    0.15 * octave(p + 17.0, 50.0, footprint);
  float m = 1.0 - CONTRAST * detail;

  // Angle below the horizon of this ground point; the floor lifts within a few degrees of it.
  float depression = atan(uEyeHeight, horizontal);
  float nearHorizon = 1.0 - smoothstep(radians(0.3), radians(4.0), depression);
  float floorLevel = mix(uFloorNear, uFloorHorizon, nearHorizon);

  gl_FragColor = vec4(vec3(floorLevel * m), m);
}
`;

export class GroundMaterial extends ShaderMaterial {
  constructor(eyeHeight: number) {
    super({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uFloorNear: new Uniform(0),
        uFloorHorizon: new Uniform(0),
        uEyeHeight: new Uniform(eyeHeight),
      },
      blending: CustomBlending,
      blendEquation: AddEquation,
      blendSrc: OneFactor,
      blendDst: SrcAlphaFactor,
      // Keep the canvas opaque: leave destination alpha as the sky wrote it.
      blendSrcAlpha: ZeroFactor,
      blendDstAlpha: OneFactor,
      depthWrite: true,
      depthTest: true,
      toneMapped: false,
    });
  }

  /** Night floor in display units, near the observer and at the horizon. */
  setFloor(near: number, horizon: number): void {
    (this.uniforms.uFloorNear as Uniform<number>).value = near;
    (this.uniforms.uFloorHorizon as Uniform<number>).value = horizon;
  }
}
