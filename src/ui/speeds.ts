const DAY = 86_400;

/**
 * Above this, Earth turns more than ~6° per frame at 60 fps and its 15° grid starts to strobe:
 * the spin is still computed truly, but what you see is aliased.
 */
export const ALIASING_SPEED = DAY;

export function isSpinAliased(speed: number): boolean {
  return Math.abs(speed) > ALIASING_SPEED;
}
