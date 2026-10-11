import { PerspectiveCamera, Sprite, SpriteMaterial, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { markerOpacity, sphereRadiusPx, spriteScaleForPixels } from './markerMath';

const H = 800;

function camera(fov = 50) {
  const c = new PerspectiveCamera(fov, 1.4, 0.05, 5000);
  c.position.set(0, 0, 100);
  c.lookAt(0, 0, 0);
  c.updateMatrixWorld();
  return c;
}

/** Projected pixel height of a non-attenuated sprite, computed through three's own matrices. */
function spritePixelHeight(cam: PerspectiveCamera, sprite: Sprite): number {
  // Mirror three's sprite shader: view-space half-height = 0.5 × scale.y × depth.
  const mv = sprite.position.clone().applyMatrix4(cam.matrixWorldInverse);
  const halfView = 0.5 * sprite.scale.y * -mv.z;
  const top = mv
    .clone()
    .add(new Vector3(0, halfView, 0))
    .applyMatrix4(cam.projectionMatrix);
  const bottom = mv
    .clone()
    .add(new Vector3(0, -halfView, 0))
    .applyMatrix4(cam.projectionMatrix);
  return ((top.y - bottom.y) / 2) * H;
}

describe('screen-space marker maths', () => {
  it('sizes a non-attenuated sprite to a fixed pixel height at any distance', () => {
    const cam = camera();
    const proj11 = cam.projectionMatrix.elements[5];
    for (const z of [0, -50, -900]) {
      const sprite = new Sprite(new SpriteMaterial({ sizeAttenuation: false }));
      sprite.position.set(3, 1, z);
      sprite.scale.setScalar(spriteScaleForPixels(24, H, proj11));
      expect(spritePixelHeight(cam, sprite)).toBeCloseTo(24, 6);
    }
  });

  it('measures a sphere’s on-screen radius consistently with the projection', () => {
    const cam = camera(50);
    const proj11 = cam.projectionMatrix.elements[5];
    // A sphere filling exactly half the view height: tan(angular radius) = tan(25°)/2.
    const distance = 100;
    const tanA = Math.tan((25 * Math.PI) / 180) / 2;
    const radius = (distance * tanA) / Math.sqrt(1 + tanA * tanA);
    expect(sphereRadiusPx(radius, distance, H, proj11)).toBeCloseTo(H / 4, 6);
    expect(sphereRadiusPx(2, 1, H, proj11)).toBe(Infinity);
  });

  it('fades the marker out as the body grows past the ring', () => {
    expect(markerOpacity(0.1, 10)).toBe(1);
    expect(markerOpacity(5, 10)).toBe(1);
    expect(markerOpacity(10, 10)).toBeCloseTo(0.5, 12);
    expect(markerOpacity(15, 10)).toBe(0);
    expect(markerOpacity(Infinity, 10)).toBe(0);
  });
});
