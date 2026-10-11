import {
  AngleFromSun,
  Body,
  Equator,
  Horizon,
  Illumination,
  MoonPhase,
  Observer,
  SearchMoonPhase,
  SearchRiseSet,
} from 'astronomy-engine';
import { MS_PER_DAY } from './constants';

/** Plain observer location (degrees, east/north positive). Structural so astro/ stays standalone. */
export interface ObserverCoords {
  readonly latitude: number;
  readonly longitude: number;
}

export const PHASE_NAMES = [
  'New Moon',
  'Waxing Crescent',
  'First Quarter',
  'Waxing Gibbous',
  'Full Moon',
  'Waning Gibbous',
  'Last Quarter',
  'Waning Crescent',
] as const;

export type PhaseName = (typeof PHASE_NAMES)[number];

/**
 * Phase name from the Moon's ecliptic longitude east of the Sun (`MoonPhase`, 0–360°).
 *
 * Eight equal 45° bins centred on 0°, 45°, 90°, … : New Moon is [337.5°, 22.5°), Waxing Crescent
 * [22.5°, 67.5°), First Quarter [67.5°, 112.5°), Waxing Gibbous [112.5°, 157.5°), Full Moon
 * [157.5°, 202.5°), Waning Gibbous [202.5°, 247.5°), Last Quarter [247.5°, 292.5°), Waning
 * Crescent [292.5°, 337.5°). Each named instant (new, quarter, full) sits mid-bin, so a name holds
 * for ~3.7 days around it.
 */
export function phaseNameFor(phaseLongitudeDeg: number): PhaseName {
  const normalized = ((phaseLongitudeDeg % 360) + 360) % 360;
  const index = Math.floor((normalized + 22.5) / 45) % 8;
  const name = PHASE_NAMES[index];
  if (!name) throw new Error(`No phase bin for ${phaseLongitudeDeg}`);
  return name;
}

export interface MoonPhaseInfo {
  /** Moon's ecliptic longitude minus the Sun's, 0–360°. */
  readonly phaseLongitude: number;
  readonly phaseName: PhaseName;
  /** Illuminated fraction of the disc, 0–1. */
  readonly illuminatedFraction: number;
  /** Sun–Earth–Moon angle (elongation) at Earth's centre, 0–180°. */
  readonly sunEarthMoonDeg: number;
}

/** Cheap (sub-millisecond); fine to call on every HUD poll. */
export function moonPhaseInfo(time: Date): MoonPhaseInfo {
  const phaseLongitude = MoonPhase(time);
  return {
    phaseLongitude,
    phaseName: phaseNameFor(phaseLongitude),
    illuminatedFraction: Illumination(Body.Moon, time).phase_fraction,
    sunEarthMoonDeg: AngleFromSun(Body.Moon, time),
  };
}

/** Moon age (days since the previous new moon), caching the surrounding lunation. */
export class MoonAgeCache {
  #prevNewMs = Number.NaN;
  #nextNewMs = Number.NaN;
  /** Number of new-moon searches performed; exposed for tests. */
  searches = 0;

  ageDays(timeMs: number): number {
    if (!(timeMs >= this.#prevNewMs && timeMs < this.#nextNewMs)) this.#refresh(timeMs);
    return (timeMs - this.#prevNewMs) / MS_PER_DAY;
  }

  #refresh(timeMs: number): void {
    const time = new Date(timeMs);
    // Lunations are at most ~29.9 days, so both searches always succeed within 31 days.
    const prev = SearchMoonPhase(0, time, -31);
    const next = SearchMoonPhase(0, time, 31);
    this.searches += 2;
    if (!prev || !next) throw new Error(`No new moon found around ${time.toISOString()}`);
    this.#prevNewMs = prev.date.getTime();
    this.#nextNewMs = next.date.getTime();
  }
}

export type NoEventReason =
  /** The Moon stays above the horizon for the whole window. */
  | 'circumpolar'
  /** The Moon stays below the horizon for the whole window. */
  | 'never-rises'
  /** The Moon crosses the horizon in the window, but not in this direction. */
  | 'none-in-window';

export type HorizonEvent =
  | { readonly found: true; readonly timeMs: number }
  | { readonly found: false; readonly reason: NoEventReason };

export interface RiseSet {
  readonly rise: HorizonEvent;
  readonly set: HorizonEvent;
}

/** How far ahead "next" rise/set looks. Long enough for any non-polar case; polar ones get a reason. */
export const RISE_SET_WINDOW_DAYS = 2;

interface DayEvents {
  readonly rises: readonly number[];
  readonly sets: readonly number[];
}

/** All crossings of one kind in [startMs, endMs), via repeated SearchRiseSet. */
function crossingsIn(
  observer: Observer,
  direction: 1 | -1,
  startMs: number,
  endMs: number,
): number[] {
  const out: number[] = [];
  let from = startMs;
  while (from < endMs) {
    const t = SearchRiseSet(
      Body.Moon,
      observer,
      direction,
      new Date(from),
      (endMs - from) / MS_PER_DAY,
    );
    if (!t) break;
    const ms = t.date.getTime();
    if (ms >= endMs) break;
    out.push(ms);
    // Consecutive same-direction crossings are ~24.8 h apart; step past this one.
    from = ms + 60_000;
  }
  return out;
}

/** Whether the Moon's upper limb is above the (refracted) horizon, matching SearchRiseSet. */
function moonIsUp(observer: Observer, timeMs: number): boolean {
  const time = new Date(timeMs);
  const eq = Equator(Body.Moon, time, observer, true, true);
  const hor = Horizon(time, observer, eq.ra, eq.dec, 'normal');
  // SearchRiseSet times the upper limb crossing; the Moon's semi-diameter is ~0.26°.
  return hor.altitude > -0.26;
}

/**
 * Next moonrise/moonset for an observer, with per-(location, UTC day) caching so the expensive
 * searches run at most once per day bucket however often it is polled.
 */
export class RiseSetCache {
  readonly #days = new Map<string, DayEvents>();
  readonly #maxEntries: number;
  /** Number of day buckets computed; exposed for tests. */
  dayComputations = 0;

  constructor(maxEntries = 64) {
    this.#maxEntries = maxEntries;
  }

  next(location: ObserverCoords, timeMs: number): RiseSet {
    const observer = new Observer(location.latitude, location.longitude, 0);
    const firstDay = Math.floor(timeMs / MS_PER_DAY);
    const rises: number[] = [];
    const sets: number[] = [];
    // The window [t, t + 2 d) spans at most three UTC day buckets.
    for (let day = firstDay; day * MS_PER_DAY < timeMs + RISE_SET_WINDOW_DAYS * MS_PER_DAY; day++) {
      const events = this.#day(location, observer, day);
      rises.push(...events.rises);
      sets.push(...events.sets);
    }
    const windowEnd = timeMs + RISE_SET_WINDOW_DAYS * MS_PER_DAY;
    const firstAfter = (list: number[]) => list.find((ms) => ms >= timeMs && ms < windowEnd);
    const rise = firstAfter(rises);
    const set = firstAfter(sets);

    let noEvent: NoEventReason = 'none-in-window';
    if (rise === undefined && set === undefined) {
      noEvent = moonIsUp(observer, timeMs) ? 'circumpolar' : 'never-rises';
    }
    return {
      rise: rise === undefined ? { found: false, reason: noEvent } : { found: true, timeMs: rise },
      set: set === undefined ? { found: false, reason: noEvent } : { found: true, timeMs: set },
    };
  }

  #day(location: ObserverCoords, observer: Observer, day: number): DayEvents {
    const key = `${location.latitude},${location.longitude}|${day}`;
    const cached = this.#days.get(key);
    if (cached) {
      // Refresh recency for LRU eviction.
      this.#days.delete(key);
      this.#days.set(key, cached);
      return cached;
    }
    const start = day * MS_PER_DAY;
    const end = start + MS_PER_DAY;
    const events: DayEvents = {
      rises: crossingsIn(observer, 1, start, end),
      sets: crossingsIn(observer, -1, start, end),
    };
    this.dayComputations++;
    this.#days.set(key, events);
    if (this.#days.size > this.#maxEntries) {
      const oldest = this.#days.keys().next().value;
      if (oldest !== undefined) this.#days.delete(oldest);
    }
    return events;
  }
}
