import { ShaderMaterial, Vector3, type Texture } from 'three';
import type { Vec3 } from '../../astro/vec';
import {
  createEclipseUniforms,
  ECLIPSE_FRAGMENT_UNIFORMS,
  type EclipseUniforms,
} from '../eclipseShading';

/**
 * Earthshine display gain, relative to full sunlight on the disc.
 *
 * Physically, a "full Earth" lights the Moon's night side at roughly 1/10,000 of sunlight — far
 * too dim to show beside the lit crescent on a screen. Like a long-exposure photograph, we boost
 * it to a few percent, keeping it proportional to Earth's illuminated fraction as seen from the
 * Moon: strongest at a thin crescent (nearly "full Earth"), absent at full Moon.
 */
export const EARTHSHINE_DISPLAY_GAIN = 0.035;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalWorld;

  void main() {
    vUv = uv;
    // Uniform scale only, so the model matrix's rotation part transforms normals correctly.
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform bool hasMap;
  uniform vec3 sunDirection;
  uniform vec3 viewDirection;
  uniform float earthshine;
  ${ECLIPSE_FRAGMENT_UNIFORMS}

  varying vec2 vUv;
  varying vec3 vNormalWorld;

  void main() {
    vec3 n = normalize(vNormalWorld);
    vec3 albedo = hasMap ? texture2D(map, vUv).rgb : vec3(0.45);

    // Lommel–Seeliger: the lunar regolith's reflectance. Unlike Lambert it has almost no limb
    // darkening, which is why the full Moon looks like a flat disc.
    float mu0 = max(dot(n, sunDirection), 0.0);
    float mu = max(dot(n, viewDirection), 0.0);
    // × the sunlight that actually reaches each point (Earth's shadow and its red glow).
    vec3 sunlight = 2.0 * mu0 / (mu0 + mu + 1e-4) * moonSimEclipseLightForNormal(n);

    // Earth sits in the viewing direction as seen from the Moon.
    float earthlight = earthshine * mu;

    gl_FragColor = vec4(albedo * (sunlight + earthlight), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

interface DiscUniforms {
  [name: string]: { value: unknown };
  map: { value: Texture | null };
  hasMap: { value: boolean };
  sunDirection: { value: Vector3 };
  viewDirection: { value: Vector3 };
  earthshine: { value: number };
}

/** The magnified Moon: true lighting geometry, lunar reflectance, display-boosted earthshine. */
export class DiscMoonMaterial extends ShaderMaterial {
  readonly #u: DiscUniforms;
  /** Eclipse lighting (sky-view axes); update via updateEclipseUniforms. */
  readonly eclipse: EclipseUniforms;

  constructor() {
    const eclipse = createEclipseUniforms();
    const uniforms: DiscUniforms = {
      ...eclipse,
      map: { value: null },
      hasMap: { value: false },
      sunDirection: { value: new Vector3(1, 0, 0) },
      viewDirection: { value: new Vector3(0, 0, 1) },
      earthshine: { value: 0 },
    };
    super({ vertexShader, fragmentShader, uniforms });
    this.#u = uniforms;
    this.eclipse = eclipse;
  }

  setMap(map: Texture | null): void {
    this.#u.map.value = map;
    this.#u.hasMap.value = map !== null;
  }

  /** Directions are world-space unit vectors from the Moon; `earthLitFraction` is 0–1. */
  setLighting(sun: Vec3, view: Vec3, earthLitFraction: number): void {
    this.#u.sunDirection.value.set(sun.x, sun.y, sun.z);
    this.#u.viewDirection.value.set(view.x, view.y, view.z);
    this.#u.earthshine.value = EARTHSHINE_DISPLAY_GAIN * earthLitFraction;
  }
}
