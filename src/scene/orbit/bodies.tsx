import { Quaternion, Vector3 } from 'three';
import type { OrbitScene } from '../../sim/orbitScene';
import { GREENWICH_POINT, NEAR_SIDE_POINT } from '../bodyLocal';
import { OrbitBody } from './OrbitBody';

const selectEarth = (o: OrbitScene) => o.earth;
const selectMoon = (o: OrbitScene) => o.moon;

const UP = new Vector3(0, 1, 0);

interface SurfaceSpikeProps {
  /** Unit vector in the body's local frame. */
  at: Vector3;
  length: number;
  color: string;
}

/** A pin standing out of a unit sphere along `at`, so it reads at any zoom. */
function SurfaceSpike({ at, length, color }: SurfaceSpikeProps) {
  const orientation = new Quaternion().setFromUnitVectors(UP, at);
  const centre = at.clone().multiplyScalar(1 + length / 2);
  return (
    <group position={centre} quaternion={orientation}>
      <mesh>
        <cylinderGeometry args={[0.03, 0.03, length, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0, length / 2, 0]}>
        <sphereGeometry args={[0.08, 12, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

/** Lat/long grid slightly above the surface, so spin is visible before textures exist. */
function Graticule({ color }: { color: string }) {
  return (
    <mesh scale={1.002}>
      <sphereGeometry args={[1, 24, 12]} />
      <meshBasicMaterial color={color} wireframe transparent opacity={0.25} />
    </mesh>
  );
}

export function Earth() {
  return (
    <OrbitBody select={selectEarth}>
      <mesh>
        <sphereGeometry args={[1, 64, 32]} />
        <meshStandardMaterial color="#2a5d9f" roughness={0.9} />
      </mesh>
      <Graticule color="#9fc3ff" />
      <SurfaceSpike at={GREENWICH_POINT} length={0.25} color="#ffd34d" />
    </OrbitBody>
  );
}

export function Moon() {
  return (
    <OrbitBody select={selectMoon}>
      <mesh>
        <sphereGeometry args={[1, 48, 24]} />
        <meshStandardMaterial color="#9a9a9a" roughness={1} />
      </mesh>
      <Graticule color="#dddddd" />
      <SurfaceSpike at={NEAR_SIDE_POINT} length={0.6} color="#ff4d4d" />
    </OrbitBody>
  );
}
