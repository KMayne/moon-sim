/** Sizes for the docked Moon disc inset (square, CSS pixels). */
export const DISC_SIZE = { min: 160, default: 280, keyboardStep: 16 } as const;

/** Header + caption rows around the square disc. */
export const DISC_CHROME_PX = 56;

/**
 * Clamp a requested disc size to what fits in the host view: never below the minimum, never taller
 * than the view (leaving room for its header/caption) and never wider than 60% of it.
 */
export function clampDiscSize(requested: number, viewWidth: number, viewHeight: number): number {
  const max = Math.max(DISC_SIZE.min, Math.min(viewHeight - DISC_CHROME_PX, viewWidth * 0.6));
  return Math.round(Math.min(max, Math.max(DISC_SIZE.min, requested)));
}

/** New size while dragging the top-left grip: growing up/left enlarges, the larger axis wins. */
export function dragDiscSize(startSize: number, dx: number, dy: number): number {
  return startSize + Math.max(-dx, -dy);
}
