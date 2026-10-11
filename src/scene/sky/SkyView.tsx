import { PerspectiveCamera, View } from '@react-three/drei';
import { Suspense, useRef } from 'react';
import { ErrorBoundary } from '../../ErrorBoundary';
import { Aurora } from '../aurora/Aurora';
import { Atmosphere } from './Atmosphere';
import { DailyArcs } from './DailyArcs';
import { DEFAULT_FOV, LookAroundControls } from './LookAroundControls';
import { CompassLabels, Ground, SkySunLight } from './skyParts';
import { SkyMoon } from './SkyMoon';

/**
 * The observer's sky. World frame is local North-Up-East with the observer at the origin (see
 * sim/skyScene.ts); one world unit is one metre as far as the atmosphere is concerned.
 */
export function SkyView({ className }: { className: string }) {
  const track = useRef<HTMLDivElement>(null);
  return (
    <View className={className} ref={track}>
      <color attach="background" args={['#000000']} />
      <PerspectiveCamera
        makeDefault
        position={[0, 0, 0]}
        fov={DEFAULT_FOV}
        near={1}
        far={100_000}
      />
      <LookAroundControls element={track} />

      {/* Without the sky textures we still show the Moon, arcs and horizon on black. */}
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <Atmosphere />
        </Suspense>
      </ErrorBoundary>
      <SkySunLight />
      <Ground />
      <SkyMoon />
      <Aurora />
      <DailyArcs />
      <CompassLabels />
    </View>
  );
}
