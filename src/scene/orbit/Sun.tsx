import { useMemo } from 'react';
import { AdditiveBlending, CanvasTexture, SRGBColorSpace } from 'three';

/** Sun distance in scene units: far enough to look distant, inside the camera's far plane. */
export const SUN_DISTANCE = 1500;
/** True angular radius of the Sun (~0.267°), at SUN_DISTANCE. */
const SUN_RADIUS = SUN_DISTANCE * Math.tan((0.267 * Math.PI) / 180);
/** Glow sprite size relative to the disc. Purely cosmetic; it emits no light. */
const GLOW_SCALE = 12;

/** Radial falloff texture for the glow sprite. */
function makeGlowTexture(): CanvasTexture | null {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255, 244, 214, 0.55)');
  g.addColorStop(0.15, 'rgba(255, 228, 170, 0.18)');
  g.addColorStop(0.5, 'rgba(255, 210, 140, 0.04)');
  g.addColorStop(1, 'rgba(255, 200, 120, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * The Sun, fixed on +x in the Sun-fixed frame: a single directional light (the only light that
 * matters for terminators and phases), a true-angular-size disc, and a faint glow.
 */
export function Sun() {
  const glow = useMemo(() => makeGlowTexture(), []);
  return (
    <group position={[SUN_DISTANCE, 0, 0]}>
      <directionalLight intensity={3} />
      <mesh>
        <sphereGeometry args={[SUN_RADIUS, 32, 16]} />
        <meshBasicMaterial color="#fff6e0" toneMapped={false} />
      </mesh>
      {glow && (
        <sprite scale={SUN_RADIUS * GLOW_SCALE}>
          <spriteMaterial
            map={glow}
            blending={AdditiveBlending}
            depthWrite={false}
            transparent
            toneMapped={false}
          />
        </sprite>
      )}
    </group>
  );
}
