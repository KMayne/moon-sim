import { useMemo } from 'react';
import { CylinderGeometry, DoubleSide } from 'three';
import { SUN_RADIUS_KM } from '../../astro/constants';
import { KM_TO_SCENE } from '../../sim/orbitScene';
import { EARTH_SHADOW_RADIUS_KM } from '../../sim/umbralLight';

/** Mean Sun distance: the cone's slope varies ±1.7% over the year, invisible at this opacity. */
const SUN_DISTANCE_KM = 149_597_871;
/** Drawn beyond the Moon's farthest apogee (~406,700 km). */
const LENGTH_KM = 450_000;

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

  return (
    <group>
      <mesh geometry={penumbra} renderOrder={1}>
        <meshBasicMaterial
          color="#7d86a3"
          transparent
          opacity={0.025}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      <mesh geometry={umbra} renderOrder={2}>
        <meshBasicMaterial
          color="#a35a4a"
          transparent
          opacity={0.06}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}
