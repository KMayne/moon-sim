import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useRef } from 'react';
import { AdditiveBlending, SRGBColorSpace, type Group } from 'three';
import { applyRotation } from '../applyTransform';
import { PRIORITY, useFrameRef } from '../frame';
import { TEXTURE_URLS } from '../textures';
import { SKY_RENDER_ORDER } from './renderOrder';

/** Render distance of the Moon in the sky view. Arbitrary: only its angular size matters. */
export const SKY_MOON_DISTANCE = 10_000;

function MoonSurface() {
  const map = useTexture(TEXTURE_URLS.moon, (t) => {
    t.colorSpace = SRGBColorSpace;
  });
  return <meshStandardMaterial map={map} roughness={1} metalness={0} blending={AdditiveBlending} />;
}

/**
 * Our textured Moon on the observer's sky: true direction (with parallax), true angular size ×
 * the moon-size visual aid, true orientation (libration, tilt of the terminator), lit by the true
 * Sun direction — so phase and bright limb are physically right.
 *
 * Additive blending approximates moonlight adding to the sky's own light: the unlit part
 * disappears into a daytime sky, as it does in reality. Limitation: no atmospheric extinction or
 * reddening of the Moon near the horizon (the sky itself does have it).
 */
export function SkyMoon() {
  const frameRef = useFrameRef();
  const group = useRef<Group>(null);

  useFrame(() => {
    const frame = frameRef.current;
    const g = group.current;
    if (!frame || !g) return;
    const { moonDirection: d, moonRotation, moonAngularRadius } = frame.sky;
    g.position.set(d.x, d.y, d.z).multiplyScalar(SKY_MOON_DISTANCE);
    applyRotation(g, moonRotation);
    g.scale.setScalar(SKY_MOON_DISTANCE * Math.tan(moonAngularRadius));
  }, PRIORITY.update);

  return (
    <group ref={group}>
      <mesh renderOrder={SKY_RENDER_ORDER.moon}>
        <sphereGeometry args={[1, 64, 32]} />
        <Suspense fallback={<meshStandardMaterial color="#9a9a9a" blending={AdditiveBlending} />}>
          <MoonSurface />
        </Suspense>
      </mesh>
    </group>
  );
}
