import { OrthographicCamera, useTexture, View } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, type RefObject } from 'react';
import { SRGBColorSpace, type Group } from 'three';
import { DISC_CAMERA_DISTANCE } from '../../sim/discScene';
import { eclipseDisplayGain } from '../../sim/eclipse';
import { applyRotation } from '../applyTransform';
import { updateEclipseUniforms } from '../eclipseShading';
import { PRIORITY, useFrameRef } from '../frame';
import { TEXTURE_URLS } from '../textures';
import { DiscMoonMaterial } from './discMoonMaterial';

/** Half-width of the view in Moon radii: the disc fills the square with a small margin. */
const FRAME_HALF_WIDTH = 1.12;

function MoonMap({ material }: { material: DiscMoonMaterial }) {
  const map = useTexture(TEXTURE_URLS.moon, (t) => {
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
  });
  useEffect(() => {
    material.setMap(map);
    return () => {
      material.setMap(null);
    };
  }, [material, map]);
  return null;
}

/** Points the camera and orients and lights the Moon from the current frame. */
function DiscRig({
  moon,
  material,
}: {
  moon: RefObject<Group | null>;
  material: DiscMoonMaterial;
}) {
  const frameRef = useFrameRef();
  const camera = useThree((s) => s.camera);

  useFrame(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const {
      cameraPosition: p,
      cameraRotation,
      moonRotation,
      sunDirection,
      viewDirection,
    } = frame.disc;
    camera.position.set(p.x, p.y, p.z);
    applyRotation(camera, cameraRotation);
    if (moon.current) applyRotation(moon.current, moonRotation);
    material.setLighting(sunDirection, viewDirection, frame.disc.earthLitFraction);
    // A magnified close-up auto-exposes like a camera, so totality shows its copper colour.
    updateEclipseUniforms(
      material.eclipse,
      frame.eclipse.sky,
      eclipseDisplayGain(frame.sky.eclipseIllumination),
    );
  }, PRIORITY.update);

  return null;
}

/**
 * The Moon as seen by the observer, magnified to fill the panel: same instant, same orientation
 * and lighting as the sky view's Moon (see sim/discScene.ts). Not affected by the moon-size aid.
 */
export function DiscView({ className }: { className: string }) {
  const moon = useRef<Group>(null);
  const material = useMemo(() => new DiscMoonMaterial(), []);
  useEffect(
    () => () => {
      material.dispose();
    },
    [material],
  );

  return (
    // index > the sky view's (1): the disc is an inset drawn over the sky view.
    <View className={className} index={3}>
      <color attach="background" args={['#05060a']} />
      <OrthographicCamera
        makeDefault
        manual
        left={-FRAME_HALF_WIDTH}
        right={FRAME_HALF_WIDTH}
        top={FRAME_HALF_WIDTH}
        bottom={-FRAME_HALF_WIDTH}
        near={0.1}
        far={DISC_CAMERA_DISTANCE * 2}
      />
      <DiscRig moon={moon} material={material} />
      <Suspense fallback={null}>
        <MoonMap material={material} />
      </Suspense>
      <group ref={moon}>
        <mesh>
          <sphereGeometry args={[1, 96, 48]} />
          <primitive object={material} attach="material" />
        </mesh>
      </group>
    </View>
  );
}
