import { OrbitControls, PerspectiveCamera, View } from '@react-three/drei';
import { Earth, Moon } from './bodies';

/** Sun distance in scene units: far enough to look distant, inside the camera's far plane. */
const SUN_DISTANCE = 1500;
/** True angular radius of the Sun (~0.267°), at SUN_DISTANCE. */
const SUN_RADIUS = SUN_DISTANCE * Math.tan((0.267 * Math.PI) / 180);

/**
 * Geocentric, Sun-fixed orbit view. The Sun sits on +x by construction (see sim/orbitScene.ts), so
 * the light and Sun disc are static; only Earth and Moon move.
 */
export function OrbitView({ className }: { className: string }) {
  return (
    <View className={className}>
      <color attach="background" args={['#020308']} />
      <PerspectiveCamera makeDefault position={[-40, 30, 90]} fov={45} near={0.05} far={5000} />
      {/* Turntable: OrbitControls keeps camera.up (ecliptic north) fixed — yaw and pitch, no roll. */}
      <OrbitControls makeDefault target={[0, 0, 0]} minDistance={1.5} maxDistance={600} />

      <ambientLight intensity={0.04} />
      <directionalLight position={[SUN_DISTANCE, 0, 0]} intensity={3} />
      <mesh position={[SUN_DISTANCE, 0, 0]}>
        <sphereGeometry args={[SUN_RADIUS, 32, 16]} />
        <meshBasicMaterial color="#fff6d5" />
      </mesh>

      <Earth />
      <Moon />
    </View>
  );
}
