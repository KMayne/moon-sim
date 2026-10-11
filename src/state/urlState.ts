import { MAX_SIM_TIME, MIN_SIM_TIME } from '../sim/clock';
import {
  customLocation,
  LOCATION_PRESETS,
  type LocationPresetId,
  type ObserverLocation,
} from './locations';

/** What a shareable link pins down. Every field is optional: absent or invalid → app default. */
export interface UrlState {
  location?: ObserverLocation;
  timeMs?: number;
  /** Sim seconds per wall second; negative runs backwards. */
  speed?: number;
}

const isPresetId = (id: string): id is LocationPresetId => id in LOCATION_PRESETS;

function parseNumber(text: string | null): number | undefined {
  if (text === null || text.trim() === '') return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Reads `?loc=tromso` or `?lat=..&lon=..`, `t=<ISO 8601>`, `speed=<signed number>`.
 * `allowedSpeeds` are the magnitudes the UI can represent; anything else is ignored.
 */
export function parseUrlState(search: string, allowedSpeeds: readonly number[]): UrlState {
  const params = new URLSearchParams(search);
  const state: UrlState = {};

  const loc = params.get('loc');
  const lat = parseNumber(params.get('lat'));
  const lon = parseNumber(params.get('lon'));
  if (loc !== null && isPresetId(loc)) {
    state.location = LOCATION_PRESETS[loc];
  } else if (lat !== undefined && lon !== undefined && Math.abs(lat) <= 90) {
    state.location = customLocation(lat, lon);
  }

  const t = params.get('t');
  if (t !== null) {
    const ms = Date.parse(t);
    if (Number.isFinite(ms) && ms >= MIN_SIM_TIME && ms <= MAX_SIM_TIME) state.timeMs = ms;
  }

  const speed = parseNumber(params.get('speed'));
  if (speed !== undefined && allowedSpeeds.includes(Math.abs(speed))) state.speed = speed;

  return state;
}

/** Minute precision keeps links short and stable. */
const toIsoMinute = (ms: number): string => `${new Date(ms).toISOString().slice(0, 16)}Z`;

const round = (n: number): string => String(Math.round(n * 1e4) / 1e4);

export function serializeUrlState({ location, timeMs, speed }: Required<UrlState>): string {
  const params = new URLSearchParams();
  if (location.id === 'custom') {
    params.set('lat', round(location.latitude));
    params.set('lon', round(location.longitude));
  } else {
    params.set('loc', location.id);
  }
  params.set('t', toIsoMinute(timeMs));
  params.set('speed', String(speed));
  return `?${params.toString()}`;
}
