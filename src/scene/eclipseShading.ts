import { Vector3, type MeshStandardMaterial, type WebGLProgramParametersWithUniforms } from 'three';
import type { EclipseGeometry } from '../sim/eclipse';
import { ECLIPSE_GLSL } from '../sim/eclipseGlsl';

/**
 * Per-view uniforms for eclipse lighting on a Moon mesh. Shared by reference: update the values once
 * per frame and every material holding them follows.
 */
export interface EclipseUniforms {
  [name: string]: { value: unknown };
  /** True geocentric Moon centre, km, in the view's world axes. */
  moonSimMoonCenterKm: { value: Vector3 };
  /** True geocentric Sun position, km, in the view's world axes. */
  moonSimSunKm: { value: Vector3 };
  /** Display gain (auto-exposure) applied to the Moon's sunlight during an eclipse; 1 otherwise. */
  moonSimEclipseGain: { value: number };
}

export function createEclipseUniforms(): EclipseUniforms {
  return {
    moonSimMoonCenterKm: { value: new Vector3(384_400, 0, 0) },
    moonSimSunKm: { value: new Vector3(-1.496e8, 0, 0) },
    moonSimEclipseGain: { value: 1 },
  };
}

export function updateEclipseUniforms(
  uniforms: EclipseUniforms,
  geometry: EclipseGeometry,
  gain: number,
): void {
  const { moonCenterKm: m, sunKm: s } = geometry;
  uniforms.moonSimMoonCenterKm.value.set(m.x, m.y, m.z);
  uniforms.moonSimSunKm.value.set(s.x, s.y, s.z);
  uniforms.moonSimEclipseGain.value = gain;
}

/**
 * GLSL for a fragment: eclipse light at the true-size Moon's surface point under world normal `n`.
 * Using the normal (not the rendered position) keeps the shadow true even when the Moon is drawn
 * enlarged or moved closer by the visual aids.
 */
export const ECLIPSE_FRAGMENT_UNIFORMS = /* glsl */ `
uniform vec3 moonSimMoonCenterKm;
uniform vec3 moonSimSunKm;
uniform float moonSimEclipseGain;
${ECLIPSE_GLSL}
vec3 moonSimEclipseLightForNormal(vec3 n) {
  vec3 p = moonSimMoonCenterKm + MOON_SIM_MOON_RADIUS_KM * normalize(n);
  return moonSimLunarEclipseLight(p, moonSimSunKm) * moonSimEclipseGain;
}
`;

/**
 * Makes a MeshStandardMaterial on a Moon sphere eclipse-aware: its direct (sun) lighting is
 * multiplied by the light that actually reaches each surface point. Ambient light is untouched.
 */
export function makeEclipseAware(material: MeshStandardMaterial, uniforms: EclipseUniforms): void {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMoonSimNormalWorld;')
      .replace(
        '#include <beginnormal_vertex>',
        // Uniform scale only, so the model matrix's rotation part maps normals to world.
        '#include <beginnormal_vertex>\nvMoonSimNormalWorld = mat3(modelMatrix) * objectNormal;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec3 vMoonSimNormalWorld;\n${ECLIPSE_FRAGMENT_UNIFORMS}`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        vec3 moonSimEclipse = moonSimEclipseLightForNormal(vMoonSimNormalWorld);
        reflectedLight.directDiffuse *= moonSimEclipse;
        reflectedLight.directSpecular *= moonSimEclipse;`,
      );
  };
  material.customProgramCacheKey = () => 'moon-sim-eclipse';
  material.needsUpdate = true;
}
