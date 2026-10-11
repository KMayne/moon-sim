const MIN = 60;
const HOUR = 3600;
const DAY = 86_400;

/** Speed presets: sim seconds per wall second. */
export const SPEED_PRESETS = {
  Paused: 0,
  'Real time': 1,
  '1 min/s': MIN,
  '1 h/s': HOUR,
  '6 h/s': 6 * HOUR,
  '1 day/s': DAY,
  '1 week/s (seasons)': 7 * DAY,
  '30 days/s (seasons)': 30 * DAY,
} as const satisfies Record<string, number>;

/**
 * Above this, Earth turns more than ~6° per frame at 60 fps and its 15° grid starts to strobe:
 * the spin is still computed truly, but what you see is aliased.
 */
export const ALIASING_SPEED = DAY;

export function isSpinAliased(speed: number): boolean {
  return Math.abs(speed) > ALIASING_SPEED;
}
