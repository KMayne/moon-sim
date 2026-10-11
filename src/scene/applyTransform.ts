import { Matrix4, type Object3D } from 'three';
import type { Mat3 } from '../astro/vec';
import type { BodyTransform } from '../sim/orbitScene';

const scratch = new Matrix4();

/** Set an object's rotation from a row-major Mat3. */
export function applyRotation(object: Object3D, m: Mat3): void {
  // Matrix4.set takes row-major arguments, matching Mat3.
  scratch.set(
    m[0][0], m[0][1], m[0][2], 0,
    m[1][0], m[1][1], m[1][2], 0,
    m[2][0], m[2][1], m[2][2], 0,
    0, 0, 0, 1,
  ); // prettier-ignore
  object.quaternion.setFromRotationMatrix(scratch);
}

/**
 * The only way sim state reaches a body's Object3D: position, orientation and radius (as uniform
 * scale, so meshes are built at unit radius).
 */
export function applyTransform(object: Object3D, t: BodyTransform): void {
  object.position.set(t.position.x, t.position.y, t.position.z);
  applyRotation(object, t.rotation);
  object.scale.setScalar(t.radius);
}
