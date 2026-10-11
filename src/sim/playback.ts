const MIN = 60;
const HOUR = 3600;
const DAY = 86_400;

/** Speed steps (sim seconds per wall second), slowest first. Faster/slower move along this list. */
export const SPEED_STEPS = [
  { speed: 1, label: 'Real time' },
  { speed: MIN, label: '1 min/s' },
  { speed: 10 * MIN, label: '10 min/s' },
  { speed: HOUR, label: '1 h/s' },
  { speed: 6 * HOUR, label: '6 h/s' },
  { speed: DAY, label: '1 day/s' },
  { speed: 7 * DAY, label: '1 week/s' },
  { speed: 30 * DAY, label: '30 days/s' },
] as const;

export const DEFAULT_STEP = SPEED_STEPS.findIndex((s) => s.speed === HOUR);

/** Play/pause, direction and speed step. The clock's signed speed is derived from this. */
export interface Playback {
  readonly playing: boolean;
  readonly reverse: boolean;
  /** Index into SPEED_STEPS. */
  readonly step: number;
}

export const DEFAULT_PLAYBACK: Playback = { playing: true, reverse: false, step: DEFAULT_STEP };

const clampStep = (step: number): number =>
  Math.min(SPEED_STEPS.length - 1, Math.max(0, Math.round(step)));

/** Signed sim seconds per wall second; 0 while paused. */
export function playbackSpeed({ playing, reverse, step }: Playback): number {
  if (!playing) return 0;
  const { speed } = SPEED_STEPS[clampStep(step)] ?? SPEED_STEPS[0];
  return reverse ? -speed : speed;
}

export const faster = (p: Playback): Playback => ({ ...p, step: clampStep(p.step + 1) });
/** Slower stops at real time; it never silently flips direction (that's `toggleReverse`). */
export const slower = (p: Playback): Playback => ({ ...p, step: clampStep(p.step - 1) });
export const togglePlaying = (p: Playback): Playback => ({ ...p, playing: !p.playing });
export const toggleReverse = (p: Playback): Playback => ({ ...p, reverse: !p.reverse });

/**
 * Playback for a signed speed (e.g. from a shared link). 0 means paused at the default step;
 * anything else must be one of SPEED_STEPS (either direction), otherwise null.
 */
export function playbackFromSpeed(speed: number): Playback | null {
  if (speed === 0) return { ...DEFAULT_PLAYBACK, playing: false };
  const step = SPEED_STEPS.findIndex((s) => s.speed === Math.abs(speed));
  return step === -1 ? null : { playing: true, reverse: speed < 0, step };
}

export function speedLabel(p: Playback): string {
  const { label } = SPEED_STEPS[clampStep(p.step)] ?? SPEED_STEPS[0];
  return p.reverse ? `${label} (reverse)` : label;
}
