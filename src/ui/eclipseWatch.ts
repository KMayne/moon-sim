import type {
  GlobalSolarEclipse,
  InProgress,
  LocalSolarEclipse,
  LunarEclipse,
} from '../astro/eclipses';
import { SPEED_STEPS, type Playback } from '../sim/playback';

const MIN = 60_000;

/** Lead-in before the first interesting contact, so you see it start. */
const LEAD_IN_MS = 15 * MIN;
/**
 * 10 min/s plays a ~3.5 h umbral lunar eclipse in ~20 s and a ~2–2.5 h local solar eclipse in
 * ~15 s: long enough to follow, short enough to watch in one go.
 */
const WATCH_SPEED = 10 * 60;
const WATCH_STEP = SPEED_STEPS.findIndex((s) => s.speed === WATCH_SPEED);

export interface WatchPlan {
  readonly timeMs: number;
  readonly playback: Playback;
}

const plan = (timeMs: number): WatchPlan => ({
  timeMs,
  playback: { playing: true, reverse: false, step: WATCH_STEP },
});

/** Jump to just before the umbra arrives (or the penumbra, for a penumbral-only eclipse). */
export const watchLunar = (e: LunarEclipse): WatchPlan =>
  plan((e.partialStartMs ?? e.startMs) - LEAD_IN_MS);

export const watchLocalSolar = (e: LocalSolarEclipse): WatchPlan => plan(e.startMs - LEAD_IN_MS);

/** The shadow is on Earth for a few hours around greatest eclipse; start well before it. */
export const watchGlobalSolar = (e: GlobalSolarEclipse): WatchPlan => plan(e.peakMs - 90 * MIN);

const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export const lunarTitle = (e: Pick<LunarEclipse, 'kind'>): string =>
  `${capitalise(e.kind)} lunar eclipse`;

export const solarTitle = (e: Pick<LocalSolarEclipse, 'kind'>): string =>
  `${capitalise(e.kind)} solar eclipse`;

/** "65.2°N 25.2°W" */
export function formatLatLon(latitude: number, longitude: number): string {
  const ns = latitude >= 0 ? 'N' : 'S';
  const ew = longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(latitude).toFixed(1)}°${ns} ${Math.abs(longitude).toFixed(1)}°${ew}`;
}

/** e.g. "Total lunar eclipse in progress" or "Partial solar eclipse in progress (83%)". */
export function inProgressText(p: InProgress): string {
  if (p.body === 'moon') return `${capitalise(p.stage)} lunar eclipse in progress`;
  return `${solarTitle(p.eclipse)} in progress (${Math.round(p.eclipse.obscuration * 100)}% covered)`;
}
