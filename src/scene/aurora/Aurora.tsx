import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, DoubleSide, ShaderMaterial, type IUniform, type Mesh } from 'three';
import { useSimStore } from '../../state/store';
import { PRIORITY, useFrameRef } from '../frame';
import { SKY_RENDER_ORDER } from '../sky/renderOrder';
import { auroraFragmentShader, auroraVertexShader } from './auroraShader';
import { curtainGeometry } from './curtainGeometry';
import { auroraIntensity, auroraStatus } from '../../sim/auroraVisibility';

type AuroraMaterial = ShaderMaterial & {
  uniforms: { uTime: IUniform<number>; uIntensity: IUniform<number> };
};

/** Beyond the sky Moon (10,000) so the Moon hides it, inside the camera's far plane. */
const CURTAIN_RADIUS = 20_000;

/**
 * Cosmetic aurora on the northern horizon. Deliberately isolated from the simulation: it animates
 * on its own wall clock, and its only inputs are the toggle, the observer's latitude and how dark
 * the sky is (read from the already-computed frame). Lint forbids it from importing astronomy or
 * the sim clock.
 */
export function Aurora() {
  const enabled = useSimStore((s) => s.auroraEnabled);
  const latitude = useSimStore((s) => s.location.latitude);
  const frameRef = useFrameRef();
  const mesh = useRef<Mesh>(null);

  const geometry = useMemo(
    () =>
      curtainGeometry({ azFrom: 300, azTo: 420, altFrom: 3, altTo: 40, radius: CURTAIN_RADIUS }),
    [],
  );
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: auroraVertexShader,
        fragmentShader: auroraFragmentShader,
        uniforms: { uTime: { value: 0 }, uIntensity: { value: 0 } },
        blending: AdditiveBlending,
        // Seen from inside the band.
        side: DoubleSide,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  useFrame(() => {
    const m = mesh.current;
    const frame = frameRef.current;
    if (!m || !frame) return;
    const sunAltitude = frame.sky.sun.altitude;
    const status = auroraStatus(latitude, sunAltitude);
    // Only touch the store when the reason changes (rare), never every frame.
    const store = useSimStore.getState();
    if (status !== store.auroraStatus) store.setAuroraStatus(status);
    const intensity = enabled ? auroraIntensity(latitude, sunAltitude) : 0;
    m.visible = intensity > 0;
    const { uniforms } = m.material as AuroraMaterial;
    uniforms.uIntensity.value = intensity;
    // Its own clock: wall time, unaffected by sim speed, pause or reverse.
    uniforms.uTime.value = performance.now() / 1000;
  }, PRIORITY.update);

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      material={material}
      visible={false}
      frustumCulled={false}
      renderOrder={SKY_RENDER_ORDER.aurora}
    />
  );
}
