import { OrbitControls, PerspectiveCamera, View } from '@react-three/drei';
import { Earth, Moon } from './bodies';
import { OrbitPath } from './OrbitPath';
import { Sun } from './Sun';

/**
 * Opening shot with Sun, Earth and the whole lunar orbit in frame: behind Earth from the Sun, above
 * the ecliptic and to one side, so the Sun sits ~28° off-axis and the Moon's ~60 R⊕ orbit fits
 * wherever the Moon is.
 */
const START_CAMERA_POSITION: [number, number, number] = [-150, 45, 67];

/**
 * Geocentric, Sun-fixed orbit view. The Sun sits on +x by construction (see sim/orbitScene.ts), so
 * the light and Sun disc are static; only Earth, Moon and the orbit path move.
 */
export function OrbitView({ className }: { className: string }) {
  return (
    <View className={className}>
      <color attach="background" args={['#020308']} />
      <PerspectiveCamera
        makeDefault
        position={START_CAMERA_POSITION}
        fov={50}
        near={0.05}
        far={5000}
      />
      {/* Turntable: OrbitControls keeps camera.up (ecliptic north) fixed — yaw and pitch, no roll. */}
      <OrbitControls makeDefault target={[0, 0, 0]} minDistance={1.5} maxDistance={600} />

      {/* Just enough fill to make out night sides; terminators come from the Sun alone. */}
      <ambientLight intensity={0.02} />
      <Sun />

      <Earth />
      <Moon />
      <OrbitPath />
    </View>
  );
}
