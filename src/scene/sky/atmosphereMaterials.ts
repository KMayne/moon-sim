import { SkyMaterial, StarsMaterial } from '@takram/three-atmosphere';
import { Uniform, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three';
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

const DISPLAY_GLSL = /* glsl */ `
uniform float moonSimExposure;

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
  vec3 color = radiance * moonSimExposure / 0.6;
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

function injectDisplay(parameters: WebGLProgramParametersWithUniforms): void {
  parameters.fragmentShader = parameters.fragmentShader
    .replace('precision highp sampler3D;', `precision highp sampler3D;\n${DISPLAY_GLSL}`)
    .replace(
      '#include <mrt_output>',
      'outputColor.rgb = moonSimDisplay(outputColor.rgb);\n#include <mrt_output>',
    );
}

export class DisplaySkyMaterial extends SkyMaterial {
  constructor() {
    // Our own textured, correctly phased Moon replaces takram's plain disc.
    super({ moon: false });
    this.uniforms.moonSimExposure = new Uniform(INITIAL_EXPOSURE);
  }

  set exposure(value: number) {
    (this.uniforms.moonSimExposure as Uniform<number>).value = value;
  }

  override onBeforeCompile(p: WebGLProgramParametersWithUniforms, r: WebGLRenderer): void {
    injectDisplay(p);
    super.onBeforeCompile(p, r);
  }
}

export class DisplayStarsMaterial extends StarsMaterial {
  constructor() {
    super({ background: true, intensity: STAR_INTENSITY });
    this.uniforms.moonSimExposure = new Uniform(INITIAL_EXPOSURE);
  }

  set exposure(value: number) {
    (this.uniforms.moonSimExposure as Uniform<number>).value = value;
  }

  override onBeforeCompile(p: WebGLProgramParametersWithUniforms, r: WebGLRenderer): void {
    injectDisplay(p);
    super.onBeforeCompile(p, r);
  }
}
