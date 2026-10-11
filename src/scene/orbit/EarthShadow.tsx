import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { CylinderGeometry, DoubleSide, type MeshBasicMaterial, type Vector3 } from 'three';
import { SUN_RADIUS_KM } from '../../astro/constants';
import { KM_TO_SCENE } from '../../sim/orbitScene';
import { EARTH_SHADOW_RADIUS_KM } from '../../sim/umbralLight';
import { PRIORITY } from '../frame';

/** Mean Sun distance: the cone's slope varies ±1.7% over the year, invisible at this opacity. */
const SUN_DISTANCE_KM = 149_597_871;
/** Drawn beyond the Moon's farthest apogee (~406,700 km). */
const LENGTH_KM = 450_000;

const PENUMBRA_OPACITY = 0.025;
const UMBRA_OPACITY = 0.06;

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Penumbra radius (scene units) at `distance` behind Earth along the shadow axis. */
const penumbraRadiusAt = (distanceKm: number): number =>
  (EARTH_SHADOW_RADIUS_KM +
    (distanceKm / SUN_DISTANCE_KM) * (SUN_RADIUS_KM + EARTH_SHADOW_RADIUS_KM)) *
  KM_TO_SCENE;

/**
 * How much of the veil to show for this camera. The cones are a diagram: seen from outside they
 * read as Earth's shadow, but from inside, the translucent walls surround the camera and can only
 * add light to black space, a glow rather than a shadow. So the veil fades out as the camera nears
 * the penumbra and is gone inside it; there the Moon's own eclipse shading tells the story.
 */
function veilVisibility(position: Vector3): number {
  if (position.x >= 0) return 1;
  const behindKm = -position.x / KM_TO_SCENE;
  if (behindKm > LENGTH_KM) return 1;
  const edge = penumbraRadiusAt(behindKm);
  return smoothstep(edge, edge * 1.5, Math.hypot(position.y, position.z));
}

/** A cone opening from Earth along −x (away from the Sun in the Sun-fixed scene). */
function shadowCone(radiusAtEarthKm: number, radiusAtEndKm: number): CylinderGeometry {
  const g = new CylinderGeometry(
    radiusAtEndKm * KM_TO_SCENE,
    radiusAtEarthKm * KM_TO_SCENE,
    LENGTH_KM * KM_TO_SCENE,
    96,
    1,
    true,
  );
  // Cylinder axis is +y, base (radiusBottom) at −y: turn it so the base sits on Earth, tip at −x.
  g.translate(0, (LENGTH_KM * KM_TO_SCENE) / 2, 0);
  g.rotateZ(Math.PI / 2);
  return g;
}

/**
 * Earth's umbra and penumbra behind it, as faint veils, so the Moon can be seen passing through
 * them in an eclipse. True scale: with the moon-distance or body-size visual aids active the Moon
 * is drawn elsewhere or larger than the shadow it is in; its shading still follows the true
 * geometry (scene/eclipseShading.ts).
 */
export function EarthShadow() {
  const [umbra, penumbra] = useMemo(() => {
    const u = LENGTH_KM / SUN_DISTANCE_KM;
    const umbraEnd = SUN_RADIUS_KM - (1 + u) * (SUN_RADIUS_KM - EARTH_SHADOW_RADIUS_KM);
    const penumbraEnd = -SUN_RADIUS_KM + (1 + u) * (SUN_RADIUS_KM + EARTH_SHADOW_RADIUS_KM);
    return [
      shadowCone(EARTH_SHADOW_RADIUS_KM, umbraEnd),
      shadowCone(EARTH_SHADOW_RADIUS_KM, penumbraEnd),
    ];
  }, []);

  const penumbraMaterial = useRef<MeshBasicMaterial>(null);
  const umbraMaterial = useRef<MeshBasicMaterial>(null);

  useFrame(({ camera }) => {
    const v = veilVisibility(camera.position);
    if (penumbraMaterial.current) penumbraMaterial.current.opacity = PENUMBRA_OPACITY * v;
    if (umbraMaterial.current) umbraMaterial.current.opacity = UMBRA_OPACITY * v;
  }, PRIORITY.update);

  return (
    <group>
      <mesh geometry={penumbra} renderOrder={1}>
        <meshBasicMaterial
          ref={penumbraMaterial}
          color="#7d86a3"
          transparent
          opacity={PENUMBRA_OPACITY}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      <mesh geometry={umbra} renderOrder={2}>
        <meshBasicMaterial
          ref={umbraMaterial}
          color="#a35a4a"
          transparent
          opacity={UMBRA_OPACITY}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}
