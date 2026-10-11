import { OrbitControls, PerspectiveCamera, View } from '@react-three/drei';
import type { OrbitScene } from '../../sim/orbitScene';
import { BodyMarker } from '../markers/BodyMarker';
import { Earth, Moon } from './bodies';
import { EarthShadow } from './EarthShadow';
import { OpeningShot } from './OpeningShot';
import { OrbitPath } from './OrbitPath';
import { Sun } from './Sun';

/** Far enough for a portrait phone's opening shot; well inside the Sun disc at 1500. */
const MAX_CAMERA_DISTANCE = 1000;

const selectEarth = (o: OrbitScene) => o.earth;
const selectMoon = (o: OrbitScene) => o.moon;

/**
 * Geocentric, Sun-fixed orbit view. The Sun sits on +x by construction (see sim/orbitScene.ts), so
 * the light and Sun disc are static; only Earth, Moon and the orbit path move.
 */
export function OrbitView({ className }: { className: string }) {
  return (
    <View className={className}>
      <color attach="background" args={['#020308']} />
      {/* Initial position is a placeholder; <OpeningShot> fits it to the view's shape. */}
      <PerspectiveCamera makeDefault position={[-150, 45, 67]} fov={50} near={0.05} far={5000} />
      {/* Turntable: OrbitControls keeps camera.up (ecliptic north) fixed — yaw and pitch, no roll. */}
      <OrbitControls
        makeDefault
        target={[0, 0, 0]}
        minDistance={1.5}
        maxDistance={MAX_CAMERA_DISTANCE}
      />
      <OpeningShot maxDistance={MAX_CAMERA_DISTANCE} />

      {/* Just enough fill to make out night sides; terminators come from the Sun alone. */}
      <ambientLight intensity={0.02} />
      <Sun />

      <Earth />
      <Moon />
      <EarthShadow />
      <OrbitPath />

      <BodyMarker select={selectEarth} label="Earth" color="#9fc3ff" />
      <BodyMarker select={selectMoon} label="Moon" color="#d8d8d8" />
    </View>
  );
}
