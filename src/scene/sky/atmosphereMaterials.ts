import { AtmosphereParameters, SkyMaterial, StarsMaterial } from '@takram/three-atmosphere';
import {
  AdditiveBlending,
  Color,
  Uniform,
  Vector2,
  Vector3,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from 'three';
import { GROUND_ALBEDO } from '../../sim/groundLight';
import { MESOPIC_GLSL } from '../../sim/mesopic';
import { STAR_INTENSITY } from '../../sim/skyExposure';

/**
 * takram's materials are raw GLSL3 shaders that output linear HDR radiance and expect a
 * postprocessing tone-mapping pass. We don't run postprocessing (one canvas, several drei Views),
 * so these subclasses apply exposure, ACES tone mapping (matching the renderer's default used by
 * every other material) and sRGB encoding at the end of the fragment shader. This keeps the sky's
 * exposure independent of the orbit view without touching the shared renderer.
 */

/** Initial exposure; updated every frame from sim/skyExposure.ts. */
const INITIAL_EXPOSURE = 10;

/**
 * takram outputs luminance relative to that of unit-radiance sunlight; this converts it to cd/m²,
 * which the low-light perception model (sim/mesopic.ts) needs.
 */
const CD_M2_PER_UNIT = (() => {
  const l = AtmosphereParameters.DEFAULT.sunRadianceToLuminance;
  return 0.2126 * l.x + 0.7152 * l.y + 0.0722 * l.z;
})();

const DISPLAY_GLSL = /* glsl */ `
uniform float moonSimExposure;
${MESOPIC_GLSL}

// three.js ACESFilmicToneMapping (fit by Stephen Hill), so the sky matches lit meshes.
vec3 moonSimRRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}

vec3 moonSimDisplay(vec3 radiance) {
  const mat3 inputMat = mat3(
    vec3(0.59719, 0.07600, 0.02840),
    vec3(0.35458, 0.90834, 0.13383),
    vec3(0.04823, 0.01566, 0.83777)
  );
  const mat3 outputMat = mat3(
    vec3(1.60475, -0.10208, -0.00327),
    vec3(-0.53108, 1.10813, -0.07276),
    vec3(-0.07367, -0.00605, 1.07602)
  );
  // Low-light colour perception (Purkinje shift) acts on physical luminance, before exposure.
  vec3 color = moonSimMesopic(radiance) * moonSimExposure / 0.6;
  color = outputMat * moonSimRRTAndODTFit(inputMat * color);
  color = clamp(color, 0.0, 1.0);
  // Linear → sRGB (the canvas expects display-encoded output from raw shaders).
  return mix(
    color * 12.92,
    1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055,
    step(vec3(0.0031308), color)
  );
}
`;

/**
 * Wraps the end of a takram fragment shader: `before` runs on linear radiance, then exposure + tone
 * mapping + sRGB, then `after` in display space.
 */
function injectDisplay(
  parameters: WebGLProgramParametersWithUniforms,
  { before = '', after = '' }: { before?: string; after?: string } = {},
): void {
  parameters.fragmentShader = parameters.fragmentShader
    .replace('precision highp sampler3D;', `precision highp sampler3D;\n${DISPLAY_GLSL}`)
    .replace(
      '#include <mrt_output>',
      `${before}\noutputColor.rgb = moonSimDisplay(outputColor.rgb);\n${after}\n#include <mrt_output>`,
    );
}

/**
 * Moonlight (sim/moonlight.ts). Bruneton's model is linear in its light source, so the moonlit sky
 * and ground are the same functions evaluated with the Moon's direction, scaled by the Moon/Sun
 * illuminance ratio — Rayleigh-blue moonlit sky, moonlit ground with the same albedo and aerial
 * perspective as by day. Runs only when the scale is non-zero (a uniform branch), so daytime and
 * moonless nights pay nothing. Locals used from takram's sky.frag main(): cameraPosition,
 * rayDirection, shadowLength, groundAlbedo.
 */
const MOONLIGHT_GLSL = /* glsl */ `
outputColor.rgb *= moonSimSunScale;
if (moonSimMoonScale > 0.0) {
  vec3 moonSimRadiance;
  vec3 moonSimTransmittance;
  float moonSimR = length(cameraPosition);
  float moonSimMu = dot(cameraPosition, rayDirection) / moonSimR;
  if (RayIntersectsGround(ATMOSPHERE, moonSimR, moonSimMu)) {
    float moonSimDistance = raySphereFirstIntersection(
      cameraPosition,
      rayDirection,
      ATMOSPHERE.bottom_radius
    );
    vec3 moonSimNormal = normalize(rayDirection * moonSimDistance + cameraPosition);
    vec3 moonSimSkyIrradiance;
    vec3 moonSimDirectIrradiance = GetSunAndSkyIrradiance(
      cameraPosition,
      moonSimNormal,
      moonSimMoonDirection,
      moonSimSkyIrradiance
    );
    vec3 moonSimInscatter = GetSkyRadianceToPoint(
      cameraPosition,
      ATMOSPHERE.bottom_radius * moonSimNormal,
      shadowLength,
      moonSimMoonDirection,
      moonSimTransmittance
    );
    moonSimRadiance =
      groundAlbedo * RECIPROCAL_PI * (moonSimDirectIrradiance + moonSimSkyIrradiance) *
      moonSimTransmittance + moonSimInscatter;
  } else {
    moonSimRadiance = GetSkyRadiance(
      cameraPosition,
      rayDirection,
      shadowLength,
      moonSimMoonDirection,
      moonSimTransmittance
    );
  }
  outputColor.rgb += moonSimRadiance * moonSimMoonScale;
}
`;

/**
 * Display-only night floor for the sky (see sim/groundLight.ts): added after tone mapping, above the
 * horizon only, brighter toward the horizon. `rayDirection` and `cameraPosition` (planet-centred)
 * are locals of takram's sky.frag main().
 */
const SKY_FLOOR_GLSL = /* glsl */ `
{
  float moonSimElevation = dot(rayDirection, normalize(cameraPosition));
  if (moonSimElevation >= 0.0) {
    outputColor.rgb += mix(
      moonSimSkyFloor.x,
      moonSimSkyFloor.y,
      smoothstep(0.0, 0.35, moonSimElevation)
    );
  }
}
`;

export class DisplaySkyMaterial extends SkyMaterial {
  constructor() {
    // Our own textured, correctly phased Moon replaces takram's plain disc. A non-zero ground
    // albedo makes takram render the ground with the Bruneton sun + sky irradiance term and aerial
    // perspective, through the same exposure and tone mapping as the sky.
    super({
      moon: false,
      groundAlbedo: new Color(GROUND_ALBEDO.x, GROUND_ALBEDO.y, GROUND_ALBEDO.z),
    });
    this.uniforms.moonSimExposure = new Uniform(INITIAL_EXPOSURE);
    this.uniforms.moonSimCdM2PerUnit = new Uniform(CD_M2_PER_UNIT);
    this.uniforms.moonSimSkyFloor = new Uniform(new Vector2(0, 0));
    this.uniforms.moonSimMoonDirection = new Uniform(new Vector3(0, 0, 1));
    this.uniforms.moonSimMoonScale = new Uniform(0);
    this.uniforms.moonSimSunScale = new Uniform(1);
  }

  /** Moonlight: Moon direction (ECEF) and its light relative to the Sun's (0 = off). */
  setMoonlight(x: number, y: number, z: number, scale: number): void {
    (this.uniforms.moonSimMoonDirection as Uniform<Vector3>).value.set(x, y, z);
    (this.uniforms.moonSimMoonScale as Uniform<number>).value = scale;
  }

  /** Multiplier on the Sun's own scattering (fades it out by the end of astronomical twilight). */
  setSunScale(value: number): void {
    (this.uniforms.moonSimSunScale as Uniform<number>).value = value;
  }

  /** Rendered Sun disc size (radians), including the body-size visual aid. */
  setSunDiscRadius(radians: number): void {
    this.sunAngularRadius = radians;
  }

  setExposure(value: number): void {
    (this.uniforms.moonSimExposure as Uniform<number>).value = value;
  }

  /** Night floor in display units: at the horizon and at the zenith. */
  setSkyFloor(horizon: number, zenith: number): void {
    (this.uniforms.moonSimSkyFloor as Uniform<Vector2>).value.set(horizon, zenith);
  }

  override onBeforeCompile(p: WebGLProgramParametersWithUniforms, r: WebGLRenderer): void {
    p.fragmentShader = p.fragmentShader.replace(
      'precision highp sampler3D;',
      'precision highp sampler3D;\nuniform vec2 moonSimSkyFloor;\nuniform vec3 moonSimMoonDirection;\nuniform float moonSimMoonScale;\nuniform float moonSimSunScale;',
    );
    injectDisplay(p, { before: MOONLIGHT_GLSL, after: SKY_FLOOR_GLSL });
    super.onBeforeCompile(p, r);
  }
}

/**
 * Stars, additively. takram's background stars are opaque: each star pixel recomputes the
 * Sun-lit sky behind it and overwrites the framebuffer — which drops our moonlight and night floor
 * and leaves dark specks on a moonlit sky. Instead each star pixel outputs only what the star adds
 * as displayed, display(sky + star) − display(sky), with the sky recomputed exactly as the sky shader
 * does (Sun term × sun scale + Moon term). Through the tone curve, faint stars then drown in a
 * bright moonlit sky as they do outdoors. Locals of takram's stars.frag main() (BACKGROUND
 * branch): radiance, transmittance, rayDirection, vCameraPosition, vColor.
 */
const STARS_GLSL = /* glsl */ `
{
  vec3 moonSimSky = (radiance - transmittance * vColor) * moonSimSunScale;
  if (moonSimMoonScale > 0.0) {
    vec3 moonSimTransmittance;
    moonSimSky += moonSimMoonScale * GetSkyRadiance(
      vCameraPosition,
      rayDirection,
      0.0,
      moonSimMoonDirection,
      moonSimTransmittance
    );
  }
  vec3 moonSimStar = transmittance * vColor * moonSimStarScale;
  outputColor = vec4(moonSimDisplay(moonSimSky + moonSimStar) - moonSimDisplay(moonSimSky), 1.0);
}
`;

export class DisplayStarsMaterial extends StarsMaterial {
  constructor() {
    super({ background: true, intensity: STAR_INTENSITY });
    this.uniforms.moonSimExposure = new Uniform(INITIAL_EXPOSURE);
    this.uniforms.moonSimCdM2PerUnit = new Uniform(CD_M2_PER_UNIT);
    this.uniforms.moonSimMoonDirection = new Uniform(new Vector3(0, 0, 1));
    this.uniforms.moonSimMoonScale = new Uniform(0);
    this.uniforms.moonSimSunScale = new Uniform(1);
    this.uniforms.moonSimStarScale = new Uniform(1);
    this.blending = AdditiveBlending;
    this.depthWrite = false;
  }

  /**
   * @param exposure The sky's exposure (stars must be tone-mapped against the same sky).
   * @param starExposure The exposure the stars' brightness is calibrated for.
   */
  setExposure(exposure: number, starExposure = exposure): void {
    (this.uniforms.moonSimExposure as Uniform<number>).value = exposure;
    (this.uniforms.moonSimStarScale as Uniform<number>).value = starExposure / exposure;
  }

  /** Same light sources as the sky (see DisplaySkyMaterial). */
  setLighting(
    moon: { x: number; y: number; z: number },
    moonScale: number,
    sunScale: number,
  ): void {
    (this.uniforms.moonSimMoonDirection as Uniform<Vector3>).value.set(moon.x, moon.y, moon.z);
    (this.uniforms.moonSimMoonScale as Uniform<number>).value = moonScale;
    (this.uniforms.moonSimSunScale as Uniform<number>).value = sunScale;
  }

  override onBeforeCompile(p: WebGLProgramParametersWithUniforms, r: WebGLRenderer): void {
    p.fragmentShader = p.fragmentShader
      .replace(
        'precision highp sampler3D;',
        `precision highp sampler3D;\n${DISPLAY_GLSL}\nuniform vec3 moonSimMoonDirection;\nuniform float moonSimMoonScale;\nuniform float moonSimSunScale;\nuniform float moonSimStarScale;`,
      )
      .replace('#include <mrt_output>', `${STARS_GLSL}\n#include <mrt_output>`);
    super.onBeforeCompile(p, r);
  }
}
