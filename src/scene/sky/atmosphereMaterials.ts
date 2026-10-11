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
import { CORONA_FALLOFF, CORONA_K } from '../../sim/solarEclipse';
import { STAR_INTENSITY } from '../../sim/skyExposure';
import { EYE_HEIGHT_M } from './eye';

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
 * Distance along a ray to the ground sphere, for an eye just above it. takram's
 * raySphereFirstIntersection uses the textbook quadratic: |origin|² − R² and b² − 4c each subtract
 * two numbers of ~4×10⁷ (km²) in float32, so for an eye metres above the ground both are mostly
 * rounding error. Per pixel that showed as speckle, and when the eye rounded to just below the
 * ground (at some latitudes), as a black ground. Here |origin|² − R² = h(r + R) with the eye height
 * h held to at least the real eye height, and the root is taken in the form without cancellation
 * (product of roots = c).
 */
const GROUND_DISTANCE_GLSL = /* glsl */ `
float moonSimGroundDistance(vec3 origin, vec3 direction, float radius) {
  float r = length(origin);
  float h = max(r - radius, ${EYE_HEIGHT_M.toFixed(1)} * METER_TO_LENGTH_UNIT);
  float c = h * (r + radius);
  float halfB = dot(direction, origin);
  // No ray reaches ground beyond the horizon, √c away: clamping there is exact for real hits and
  // lands rays that only graze the sphere (takram's RayIntersectsGround says ground) on the horizon.
  float discriminant = max(halfB * halfB - c, 0.0);
  return c / max(sqrt(discriminant) - halfB, sqrt(c));
}
`;

/** takram's sky.frag camera position (see DisplaySkyMaterial.onBeforeCompile). */
const TAKRAM_CAMERA_POSITION = 'vec3 cameraPosition = vCameraPosition;';

/** takram's sky.frag ground hit, which GROUND_DISTANCE_GLSL replaces. */
const TAKRAM_GROUND_DISTANCE = `float distanceToGround = raySphereFirstIntersection(
      cameraPosition,
      rayDirection,
      ATMOSPHERE.bottom_radius
    );`;

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
    float moonSimDistance = moonSimGroundDistance(
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
 * Sky and ground light during a solar eclipse that doesn't come from the hidden Sun directly:
 * light scattered in from the sunlit atmosphere outside the Moon's shadow (sim/solarEclipse.ts
 * TOTALITY_SKY_RESIDUAL). Approximated from the uneclipsed daylight at the observer: the sky's mean
 * radiance (sky irradiance / π) times the residual, rising and warming toward the horizon; the
 * ground gets albedo/π × the residual irradiance. Zero (and skipped) outside eclipses.
 */
const ECLIPSE_RESIDUAL_GLSL = /* glsl */ `
if (moonSimEclipseResidual > 0.0) {
  vec3 moonSimUp = normalize(cameraPosition);
  vec3 moonSimResSky;
  vec3 moonSimResSun = GetSunAndSkyIrradiance(cameraPosition, moonSimUp, sunDirection, moonSimResSky);
  float moonSimResElevation = dot(rayDirection, moonSimUp);
  if (moonSimResElevation >= 0.0) {
    float moonSimRim = pow(1.0 - moonSimResElevation, 6.0);
    vec3 moonSimRimTint = mix(vec3(1.0), vec3(2.2, 1.4, 0.8), moonSimRim);
    outputColor.rgb += moonSimResSky * RECIPROCAL_PI * moonSimEclipseResidual * moonSimRimTint;
  } else {
    outputColor.rgb += groundAlbedo * RECIPROCAL_PI * (moonSimResSun + moonSimResSky) * moonSimEclipseResidual;
  }
}
`;

/**
 * The Sun's disc, drawn here instead of by takram (`sun: false`) so the Moon can cover it. Added
 * after the Sun's scattered light is scaled (eclipse dimming / twilight fade): the uncovered part of
 * the photosphere keeps its full surface brightness while the sky around it darkens. Near totality
 * a corona appears (sim/solarEclipse.ts). Angles via atan(|a×b|, a·b): acos loses the precision
 * these sub-degree angles need in float32. Locals of takram's sky.frag main(): cameraPosition,
 * rayDirection, fragmentAngle; sunDirection and cosSunAngularRadius are takram uniforms.
 */
const SUN_DISC_GLSL = /* glsl */ `
{
  float moonSimLen = length(cameraPosition);
  float moonSimSkyR = max(moonSimLen, ATMOSPHERE.bottom_radius);
  float moonSimSkyMu = dot(cameraPosition, rayDirection) / moonSimLen;
  float moonSimSunR = ATMOSPHERE.sun_angular_radius;
  float moonSimToSun = atan(length(cross(rayDirection, sunDirection)), dot(rayDirection, sunDirection));
  if (moonSimToSun < moonSimSunR * 12.0 && !RayIntersectsGround(ATMOSPHERE, moonSimSkyR, moonSimSkyMu)) {
    // The body-size aid enlarges both discs; enlarging the Moon's offset from the Sun by the same
    // factor magnifies the true geometry around the Sun, so the aid never invents (or hides) an
    // eclipse. At 1× this is the true Moon direction.
    vec3 moonSimMaskMoon = normalize(sunDirection + (moonSimMoonDirection - sunDirection) * moonSimBodySize);
    float moonSimToMoon = atan(
      length(cross(rayDirection, moonSimMaskMoon)),
      dot(rayDirection, moonSimMaskMoon)
    );
    // 1 clear of the Moon's limb, 0 behind it (antialiased).
    float moonSimClear = smoothstep(
      moonSimMoonAngularRadius - fragmentAngle,
      moonSimMoonAngularRadius,
      moonSimToMoon
    );
    float moonSimDisc = smoothstep(moonSimSunR, moonSimSunR - fragmentAngle, moonSimToSun);
    float moonSimCorona = moonSimCoronaWeight * ${String(CORONA_K)} *
      pow(moonSimSunR / max(moonSimToSun, moonSimSunR), ${CORONA_FALLOFF.toFixed(1)}) * (1.0 - moonSimDisc);
    if (moonSimClear > 0.0 && moonSimDisc + moonSimCorona > 0.0) {
      vec3 moonSimSunT = GetTransmittanceToTopAtmosphereBoundary(
        ATMOSPHERE, transmittance_texture, moonSimSkyR, moonSimSkyMu);
      outputColor.rgb += moonSimSunT * GetSolarRadiance() * (moonSimDisc + moonSimCorona) * moonSimClear;
    }
  }
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
      // Drawn by SUN_DISC_GLSL instead, so the Moon can eclipse it.
      sun: false,
      groundAlbedo: new Color(GROUND_ALBEDO.x, GROUND_ALBEDO.y, GROUND_ALBEDO.z),
    });
    this.uniforms.moonSimExposure = new Uniform(INITIAL_EXPOSURE);
    this.uniforms.moonSimCdM2PerUnit = new Uniform(CD_M2_PER_UNIT);
    this.uniforms.moonSimSkyFloor = new Uniform(new Vector2(0, 0));
    this.uniforms.moonSimMoonDirection = new Uniform(new Vector3(0, 0, 1));
    this.uniforms.moonSimMoonScale = new Uniform(0);
    this.uniforms.moonSimSunScale = new Uniform(1);
    this.uniforms.moonSimMoonAngularRadius = new Uniform(0);
    this.uniforms.moonSimCoronaWeight = new Uniform(0);
    this.uniforms.moonSimEclipseResidual = new Uniform(0);
    this.uniforms.moonSimBodySize = new Uniform(1);
  }

  /**
   * Solar eclipse: the Moon's rendered angular radius (radians, same body-size scaling as the Sun's
   * disc), the corona's visibility (sim/solarEclipse.ts coronaWeight), the scattered-in residual
   * light (totalityResidual) and the body-size aid (so masking magnifies the true geometry).
   */
  setSolarEclipse(
    moonAngularRadius: number,
    coronaWeight: number,
    residual: number,
    bodySize: number,
  ): void {
    (this.uniforms.moonSimBodySize as Uniform<number>).value = bodySize;
    (this.uniforms.moonSimMoonAngularRadius as Uniform<number>).value = moonAngularRadius;
    (this.uniforms.moonSimCoronaWeight as Uniform<number>).value = coronaWeight;
    (this.uniforms.moonSimEclipseResidual as Uniform<number>).value = residual;
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
    if (
      !p.fragmentShader.includes(TAKRAM_GROUND_DISTANCE) ||
      !p.fragmentShader.includes(TAKRAM_CAMERA_POSITION)
    ) {
      throw new Error(
        'takram sky shader changed: camera / ground-distance patches no longer apply',
      );
    }
    // The eye stands EYE_HEIGHT_M above the ground. takram puts the camera on the ground itself (our
    // observer is a surface point), and in float32 it can round to just below the sphere, where the
    // atmosphere lookups (√(r² − R²)) go NaN: specks along the horizon.
    p.fragmentShader = p.fragmentShader.replace(
      TAKRAM_CAMERA_POSITION,
      `vec3 cameraPosition = normalize(vCameraPosition) * max(
        length(vCameraPosition),
        ATMOSPHERE.bottom_radius + ${EYE_HEIGHT_M.toFixed(1)} * METER_TO_LENGTH_UNIT
      );`,
    );
    p.fragmentShader = p.fragmentShader.replace(
      TAKRAM_GROUND_DISTANCE,
      'float distanceToGround = moonSimGroundDistance(cameraPosition, rayDirection, ATMOSPHERE.bottom_radius);',
    );
    p.fragmentShader = p.fragmentShader.replace(
      'precision highp sampler3D;',
      'precision highp sampler3D;\nuniform vec2 moonSimSkyFloor;\nuniform vec3 moonSimMoonDirection;\nuniform float moonSimMoonScale;\nuniform float moonSimSunScale;\nuniform float moonSimMoonAngularRadius;\nuniform float moonSimCoronaWeight;\nuniform float moonSimEclipseResidual;\nuniform float moonSimBodySize;\n' +
        GROUND_DISTANCE_GLSL,
    );
    injectDisplay(p, {
      before: MOONLIGHT_GLSL + ECLIPSE_RESIDUAL_GLSL + SUN_DISC_GLSL,
      after: SKY_FLOOR_GLSL,
    });
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
  if (moonSimEclipseResidual > 0.0) {
    vec3 moonSimUp = normalize(vCameraPosition);
    vec3 moonSimResSky;
    GetSunAndSkyIrradiance(vCameraPosition, moonSimUp, sunDirection, moonSimResSky);
    moonSimSky += moonSimResSky * 0.3183098861837907 * moonSimEclipseResidual; // 1/π
  }
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
    this.uniforms.moonSimEclipseResidual = new Uniform(0);
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

  /** Same light sources as the sky (see DisplaySkyMaterial), including any eclipse residual. */
  setLighting(
    moon: { x: number; y: number; z: number },
    moonScale: number,
    sunScale: number,
    eclipseResidual = 0,
  ): void {
    (this.uniforms.moonSimEclipseResidual as Uniform<number>).value = eclipseResidual;
    (this.uniforms.moonSimMoonDirection as Uniform<Vector3>).value.set(moon.x, moon.y, moon.z);
    (this.uniforms.moonSimMoonScale as Uniform<number>).value = moonScale;
    (this.uniforms.moonSimSunScale as Uniform<number>).value = sunScale;
  }

  override onBeforeCompile(p: WebGLProgramParametersWithUniforms, r: WebGLRenderer): void {
    p.fragmentShader = p.fragmentShader
      .replace(
        'precision highp sampler3D;',
        `precision highp sampler3D;\n${DISPLAY_GLSL}\nuniform vec3 moonSimMoonDirection;\nuniform float moonSimMoonScale;\nuniform float moonSimSunScale;\nuniform float moonSimStarScale;\nuniform float moonSimEclipseResidual;`,
      )
      .replace('#include <mrt_output>', `${STARS_GLSL}\n#include <mrt_output>`);
    super.onBeforeCompile(p, r);
  }
}
