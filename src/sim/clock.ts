/** Earliest/latest supported sim time. astronomy-engine is accurate well beyond this; the clamp keeps
 * the UI in a range where the textures, presets and timezone data make sense. */
export const MIN_SIM_TIME = Date.UTC(1900, 0, 1);
export const MAX_SIM_TIME = Date.UTC(2100, 0, 1);

export interface SimClockOptions {
  start: Date;
  /** Sim seconds per wall second. Negative runs backwards. */
  speed?: number;
  /** Wall clock in ms. Injected for tests; defaults to `performance.now`. */
  wallNow?: () => number;
}

/**
 * The single source of simulated time.
 *
 * Sim time is a pure function of wall time since the last anchor:
 *   simTime = anchorSim + speed × (wallNow − anchorWall)
 * Nothing is accumulated per frame, so dropped frames or variable frame rates cannot introduce
 * drift. Changing speed, setting the time or freezing re-anchors so time never jumps.
 */
export class SimClock {
  readonly #wallNow: () => number;
  #anchorWall: number;
  #anchorSim: number;
  #speed: number;
  #frozen = false;

  constructor({ start, speed = 1, wallNow = () => performance.now() }: SimClockOptions) {
    this.#wallNow = wallNow;
    this.#anchorWall = wallNow();
    this.#anchorSim = clamp(start.getTime());
    this.#speed = speed;
  }

  get speed(): number {
    return this.#speed;
  }

  get frozen(): boolean {
    return this.#frozen;
  }

  /** Current sim time in ms since the Unix epoch. */
  nowMs(): number {
    if (this.#frozen) return this.#anchorSim;
    const raw = this.#anchorSim + this.#speed * (this.#wallNow() - this.#anchorWall);
    const clamped = clamp(raw);
    if (clamped !== raw) {
      // Hit the supported range: stop there rather than reporting a time we keep running past.
      this.#anchorSim = clamped;
      this.#anchorWall = this.#wallNow();
      this.#speed = 0;
    }
    return clamped;
  }

  now(): Date {
    return new Date(this.nowMs());
  }

  setSpeed(speed: number): void {
    this.#reanchor();
    this.#speed = speed;
  }

  setTime(time: Date): void {
    this.#anchorSim = clamp(time.getTime());
    this.#anchorWall = this.#wallNow();
  }

  /** Stop sim time without changing speed (e.g. while the tab is hidden). */
  setFrozen(frozen: boolean): void {
    if (frozen === this.#frozen) return;
    this.#reanchor();
    this.#frozen = frozen;
  }

  #reanchor(): void {
    this.#anchorSim = this.nowMs();
    this.#anchorWall = this.#wallNow();
  }
}

const clamp = (ms: number): number => Math.min(MAX_SIM_TIME, Math.max(MIN_SIM_TIME, ms));
