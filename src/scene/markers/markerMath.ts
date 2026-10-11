/**
 * Screen-space marker maths for a perspective camera. `proj11` is projectionMatrix[1][1]
 * (= 1 / tan(fov/2)); `viewportHeightPx` is the height of the view being rendered.
 */

/**
 * Scale for a `sizeAttenuation: false` sprite so it spans `px` pixels. three multiplies such
 * sprites by view depth, so their NDC size is scale × proj11 regardless of distance.
 */
export const spriteScaleForPixels = (
  px: number,
  viewportHeightPx: number,
  proj11: number,
): number => (2 * px) / (proj11 * viewportHeightPx);

/** On-screen radius in pixels of a sphere of `radius` whose centre is `distance` from the camera. */
export function sphereRadiusPx(
  radius: number,
  distance: number,
  viewportHeightPx: number,
  proj11: number,
): number {
  if (distance <= radius) return Infinity;
  const tanAngular = radius / Math.sqrt(distance * distance - radius * radius);
  return (tanAngular * proj11 * viewportHeightPx) / 2;
}

/**
 * Marker opacity: fully shown while the body is much smaller than the label clearance, gone once
 * the body reaches the label (you can see the body itself by then).
 */
export function markerOpacity(bodyRadiusPx: number, clearancePx: number): number {
  const t = (bodyRadiusPx - 0.5 * clearancePx) / clearancePx;
  return Math.min(1, Math.max(0, 1 - t));
}
