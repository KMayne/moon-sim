/**
 * Sizes for the docked Moon disc inset (square, CSS pixels). `min` is the smallest you can resize
 * it to; `floor` is how far it shrinks below that when a short view (a phone) can't fit `min`.
 */
export const DISC_SIZE = { floor: 80, min: 160, default: 280, keyboardStep: 16 } as const;

/** Header + caption rows around the square disc. */
export const DISC_CHROME_PX = 56;

/**
 * Clamp a requested disc size to what fits in the host view: never taller than the view (leaving
 * room for its header/caption), never wider than 60% of it, and never below the minimum unless
 * the minimum itself doesn't fit, in which case it shrinks to fit (down to the floor).
 */
export function clampDiscSize(requested: number, viewWidth: number, viewHeight: number): number {
  const max = Math.max(DISC_SIZE.floor, Math.min(viewHeight - DISC_CHROME_PX, viewWidth * 0.6));
  const min = Math.min(DISC_SIZE.min, max);
  return Math.round(Math.min(max, Math.max(min, requested)));
}

/** New size while dragging the left edge: dragging left (into the view) enlarges. */
export function dragDiscSize(startSize: number, dx: number): number {
  return startSize - dx;
}

/**
 * Disc size when the panel is its own row under the views (portrait phones): a quarter of the
 * views' height, so the orbit and sky views keep most of it, between the floor and the minimum.
 */
export function rowDiscSize(viewsHeight: number): number {
  return Math.round(Math.min(DISC_SIZE.min, Math.max(DISC_SIZE.floor, viewsHeight * 0.25)));
}
