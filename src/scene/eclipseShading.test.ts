import { MeshStandardMaterial, ShaderLib, type WebGLProgramParametersWithUniforms } from 'three';
import { describe, expect, it } from 'vitest';
import { createEclipseUniforms, makeEclipseAware } from './eclipseShading';

/** Runs our onBeforeCompile against three's real standard shader source. */
function compiled(body: 'moon' | 'earth' = 'moon') {
  const material = new MeshStandardMaterial();
  const uniforms = createEclipseUniforms();
  makeEclipseAware(material, uniforms, body);
  const shader = {
    uniforms: {},
    vertexShader: ShaderLib.standard.vertexShader,
    fragmentShader: ShaderLib.standard.fragmentShader,
  } as unknown as WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, undefined as never);
  return { shader, uniforms, material };
}

describe('makeEclipseAware', () => {
  it('finds every injection point in three’s standard shader', () => {
    const { shader } = compiled();
    expect(shader.vertexShader).toContain('vMoonSimNormalWorld = mat3(modelMatrix) * objectNormal');
    expect(shader.fragmentShader).toContain('moonSimLunarEclipseLight');
    expect(shader.fragmentShader).toContain('reflectedLight.directDiffuse *= moonSimEclipse');
  });

  it('shares the view’s uniforms by reference and keys its own program', () => {
    const { shader, uniforms, material } = compiled();
    expect(shader.uniforms.moonSimSunKm).toBe(uniforms.moonSimSunKm);
    expect(material.customProgramCacheKey()).toBe('moon-sim-eclipse');
  });

  it('shades Earth with the Moon’s shadow (solar eclipses) in its own program', () => {
    const { shader, material } = compiled('earth');
    expect(shader.fragmentShader).toContain(
      'vec3 moonSimEclipse = moonSimSolarEclipseLightForNormal(vMoonSimNormalWorld)',
    );
    expect(material.customProgramCacheKey()).toBe('moon-sim-eclipse-earth');
  });
});
