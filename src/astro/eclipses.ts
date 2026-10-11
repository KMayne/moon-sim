import {
  Body,
  Equator,
  Horizon,
  NextGlobalSolarEclipse,
  NextLocalSolarEclipse,
  NextLunarEclipse,
  Observer,
  SearchGlobalSolarEclipse,
  SearchLocalSolarEclipse,
  SearchLunarEclipse,
  type GlobalSolarEclipseInfo,
  type LocalSolarEclipseInfo,
  type LunarEclipseInfo,
} from 'astronomy-engine';
import { MS_PER_DAY } from './constants';
import type { ObserverCoords } from './events';

const MS_PER_MIN = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MIN;

/**
 * Searches start this far before the query time so an eclipse already in progress is found, and so
 * the previous event (whose end bounds the cache's validity) is usually seen too. Eclipses of one
 * kind are never closer than ~a month apart.
 */
const LOOKBACK_MS = 40 * MS_PER_DAY;
/** Give up looking for a local solar eclipse with the Sun up after this long. */
export const LOCAL_SOLAR_HORIZON_YEARS = 30;
/** A global solar eclipse's shadow spends at most ~3 h on Earth either side of greatest eclipse. */
const GLOBAL_SOLAR_HALF_SPAN_MS = 3 * MS_PER_HOUR;

export type LunarEclipseKind = 'penumbral' | 'partial' | 'total';
export type SolarEclipseKind = 'partial' | 'annular' | 'total';

/** How much of a lunar eclipse the observer can see (Moon above the horizon). */
export type LunarVisibility = 'visible' | 'partly visible' | 'below horizon';

export interface LunarEclipse {
  readonly kind: LunarEclipseKind;
  readonly peakMs: number;
  /** Penumbral first/last contact (start/end of the whole event). */
  readonly startMs: number;
  readonly endMs: number;
  /** Umbral contacts, when the Moon enters the umbra at all. */
  readonly partialStartMs?: number;
  readonly partialEndMs?: number;
  readonly totalStartMs?: number;
  readonly totalEndMs?: number;
  /** Fraction of the Moon's disc in the umbra at peak (0 for penumbral). */
  readonly obscuration: number;
  readonly visibility: LunarVisibility;
}

export interface LocalSolarEclipse {
  readonly kind: SolarEclipseKind;
  /** Fraction of the Sun's disc covered at peak, as seen from the observer. */
  readonly obscuration: number;
  readonly startMs: number;
  readonly peakMs: number;
  readonly endMs: number;
  /** Sun altitude at peak, degrees (may be negative: then only part is visible). */
  readonly peakSunAltitudeDeg: number;
}

export interface GlobalSolarEclipse {
  readonly kind: SolarEclipseKind;
  readonly peakMs: number;
  /** Where greatest eclipse falls (undefined for partial eclipses whose axis misses Earth). */
  readonly latitude?: number;
  readonly longitude?: number;
}

/** Stage of an eclipse at one instant. */
export type InProgress =
  | { body: 'moon'; stage: LunarEclipseKind; eclipse: LunarEclipse }
  | { body: 'sun'; eclipse: LocalSolarEclipse };

const toObserver = (o: ObserverCoords): Observer => new Observer(o.latitude, o.longitude, 0);

/** Geometric (unrefracted) altitude of a body for an observer, degrees. */
function altitudeDeg(body: Body, ms: number, observer: Observer): number {
  const time = new Date(ms);
  const eq = Equator(body, time, observer, true, true);
  return Horizon(time, observer, eq.ra, eq.dec).altitude;
}

function toLunar(info: LunarEclipseInfo, observer: Observer): LunarEclipse {
  const peakMs = info.peak.date.getTime();
  const around = (sdMin: number): [number, number] | undefined =>
    sdMin > 0 ? [peakMs - sdMin * MS_PER_MIN, peakMs + sdMin * MS_PER_MIN] : undefined;
  const penum = around(info.sd_penum) ?? [peakMs, peakMs];
  const partial = around(info.sd_partial);
  const total = around(info.sd_total);

  // The part worth seeing is the umbral phase if there is one; sample it (or the penumbral span).
  const [from, to] = partial ?? penum;
  const samples = [from, (from + peakMs) / 2, peakMs, (peakMs + to) / 2, to];
  const up = samples.map((ms) => altitudeDeg(Body.Moon, ms, observer) > 0);
  const visibility: LunarVisibility = up.every(Boolean)
    ? 'visible'
    : up.some(Boolean)
      ? 'partly visible'
      : 'below horizon';

  return {
    kind: info.kind as LunarEclipseKind,
    peakMs,
    startMs: penum[0],
    endMs: penum[1],
    ...(partial && { partialStartMs: partial[0], partialEndMs: partial[1] }),
    ...(total && { totalStartMs: total[0], totalEndMs: total[1] }),
    obscuration: info.obscuration,
    visibility,
  };
}

function toLocalSolar(info: LocalSolarEclipseInfo): LocalSolarEclipse {
  return {
    kind: info.kind as SolarEclipseKind,
    obscuration: info.obscuration,
    startMs: info.partial_begin.time.date.getTime(),
    peakMs: info.peak.time.date.getTime(),
    endMs: info.partial_end.time.date.getTime(),
    peakSunAltitudeDeg: info.peak.altitude,
  };
}

/** Any of first contact, peak or last contact with the Sun above the horizon. */
const isLocallyVisible = (info: LocalSolarEclipseInfo): boolean =>
  [info.partial_begin, info.peak, info.partial_end].some((e) => e.altitude > 0);

function toGlobalSolar(info: GlobalSolarEclipseInfo): GlobalSolarEclipse {
  return {
    kind: info.kind as SolarEclipseKind,
    peakMs: info.peak.date.getTime(),
    ...(info.latitude !== undefined && { latitude: info.latitude }),
    ...(info.longitude !== undefined && { longitude: info.longitude }),
  };
}

/** A search result plus the sim-time range over which it stays "the next (or current) one". */
interface Cached<T> {
  readonly value: T | null;
  readonly validFrom: number;
  readonly validUntil: number;
  readonly key: string;
}

const isValid = <T>(c: Cached<T> | null, key: string, ms: number): c is Cached<T> =>
  c !== null && c.key === key && ms >= c.validFrom && ms < c.validUntil;

/**
 * Walks a sequence of events (each found from the previous one's peak) starting before `ms`, and
 * returns the first whose end is after `ms`, valid from the previous accepted event's end.
 */
function scan<I, T>(
  ms: number,
  first: (fromMs: number) => I,
  next: (prev: I) => I,
  accept: (info: I) => boolean,
  convert: (info: I) => T,
  endOf: (info: I) => number,
  stopAtMs: number,
): { value: T | null; validFrom: number; validUntil: number } {
  const searchFrom = ms - LOOKBACK_MS;
  // An event peaking just before searchFrom could still be in progress a few hours after it.
  let validFrom = searchFrom + 4 * MS_PER_HOUR;
  let info = first(searchFrom);
  for (;;) {
    const end = endOf(info);
    if (end > stopAtMs) return { value: null, validFrom, validUntil: stopAtMs };
    if (accept(info)) {
      if (end > ms) return { value: convert(info), validFrom, validUntil: end };
      validFrom = end;
    }
    info = next(info);
  }
}

/**
 * Next (or in-progress) eclipses for a sim time. The searches are expensive (milliseconds each), so
 * each result is cached over the whole sim-time range for which it remains the answer — forwards
 * or in reverse — and recomputed only when sim time leaves that range or the location changes.
 */
export class EclipseCache {
  #lunar: Cached<LunarEclipse> | null = null;
  #localSolar: Cached<LocalSolarEclipse> | null = null;
  #globalSolar: Cached<GlobalSolarEclipse> | null = null;
  /** Number of searches run (for tests). */
  searches = 0;

  lunar(observerCoords: ObserverCoords, ms: number): LunarEclipse {
    const key = `${observerCoords.latitude},${observerCoords.longitude}`;
    if (!isValid(this.#lunar, key, ms)) {
      this.searches++;
      const observer = toObserver(observerCoords);
      const found = scan(
        ms,
        (from) => SearchLunarEclipse(new Date(from)),
        (prev) => NextLunarEclipse(prev.peak),
        () => true,
        (info) => toLunar(info, observer),
        (info) => info.peak.date.getTime() + info.sd_penum * MS_PER_MIN,
        Infinity,
      );
      this.#lunar = { ...found, key };
    }
    const value = this.#lunar.value;
    if (!value) throw new Error('Lunar eclipse search returned nothing');
    return value;
  }

  /** Next solar eclipse with the Sun up for the observer, or null if none within the horizon. */
  localSolar(observerCoords: ObserverCoords, ms: number): LocalSolarEclipse | null {
    const key = `${observerCoords.latitude},${observerCoords.longitude}`;
    if (!isValid(this.#localSolar, key, ms)) {
      this.searches++;
      const observer = toObserver(observerCoords);
      const found = scan(
        ms,
        (from) => SearchLocalSolarEclipse(new Date(from), observer),
        (prev) => NextLocalSolarEclipse(prev.peak.time, observer),
        isLocallyVisible,
        toLocalSolar,
        (info) => info.partial_end.time.date.getTime(),
        ms + LOCAL_SOLAR_HORIZON_YEARS * 365.25 * MS_PER_DAY,
      );
      this.#localSolar = { ...found, key };
    }
    return this.#localSolar.value;
  }

  globalSolar(ms: number): GlobalSolarEclipse {
    if (!isValid(this.#globalSolar, '', ms)) {
      this.searches++;
      const found = scan(
        ms,
        (from) => SearchGlobalSolarEclipse(new Date(from)),
        (prev) => NextGlobalSolarEclipse(prev.peak),
        () => true,
        toGlobalSolar,
        (info) => info.peak.date.getTime() + GLOBAL_SOLAR_HALF_SPAN_MS,
        Infinity,
      );
      this.#globalSolar = { ...found, key: '' };
    }
    const value = this.#globalSolar.value;
    if (!value) throw new Error('Global solar eclipse search returned nothing');
    return value;
  }
}

/** Stage of a lunar eclipse at `ms`, or null outside it. */
export function lunarStageAt(e: LunarEclipse, ms: number): LunarEclipseKind | null {
  if (ms < e.startMs || ms >= e.endMs) return null;
  if (e.totalStartMs !== undefined && e.totalEndMs !== undefined) {
    if (ms >= e.totalStartMs && ms < e.totalEndMs) return 'total';
  }
  if (e.partialStartMs !== undefined && e.partialEndMs !== undefined) {
    if (ms >= e.partialStartMs && ms < e.partialEndMs) return 'partial';
  }
  return 'penumbral';
}

/**
 * An eclipse happening now that the observer could see (the body above the horizon), preferring a
 * solar eclipse. Penumbral-only stages are reported too; the HUD can decide how to word them.
 */
export function eclipseInProgress(
  lunar: LunarEclipse,
  localSolar: LocalSolarEclipse | null,
  observerCoords: ObserverCoords,
  ms: number,
): InProgress | null {
  const observer = toObserver(observerCoords);
  if (localSolar && ms >= localSolar.startMs && ms < localSolar.endMs) {
    if (altitudeDeg(Body.Sun, ms, observer) > 0) return { body: 'sun', eclipse: localSolar };
  }
  const stage = lunarStageAt(lunar, ms);
  if (stage && altitudeDeg(Body.Moon, ms, observer) > 0) {
    return { body: 'moon', stage, eclipse: lunar };
  }
  return null;
}
