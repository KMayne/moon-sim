import { MAX_SIM_TIME, MIN_SIM_TIME } from '../sim/clock';
import { playbackFromSpeed, playbackSpeed, type Playback } from '../sim/playback';
import {
  CUSTOM_LABEL,
  customLocation,
  LOCATION_PRESETS,
  type LocationPresetId,
  type ObserverLocation,
} from './locations';

/** What a shareable link pins down. Every field is optional: absent or invalid → app default. */
export interface UrlState {
  location?: ObserverLocation;
  timeMs?: number;
  playback?: Playback;
}

const isPresetId = (id: string): id is LocationPresetId => id in LOCATION_PRESETS;

function parseNumber(text: string | null): number | undefined {
  if (text === null || text.trim() === '') return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Reads `?loc=tromso` or `?lat=..&lon=..[&name=..]`, `t=<ISO 8601>`, `speed=<signed step speed>` and
 * `paused=1`. Speeds must be one of the playback steps; `speed=0` (older links) means paused.
 */
export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const state: UrlState = {};

  const loc = params.get('loc');
  const lat = parseNumber(params.get('lat'));
  const lon = parseNumber(params.get('lon'));
  if (loc !== null && isPresetId(loc)) {
    state.location = LOCATION_PRESETS[loc];
  } else if (lat !== undefined && lon !== undefined && Math.abs(lat) <= 90) {
    const name = params.get('name')?.trim();
    state.location = customLocation(lat, lon, name || undefined);
  }

  const t = params.get('t');
  if (t !== null) {
    const ms = Date.parse(t);
    if (Number.isFinite(ms) && ms >= MIN_SIM_TIME && ms <= MAX_SIM_TIME) state.timeMs = ms;
  }

  const speed = parseNumber(params.get('speed'));
  const playback = speed === undefined ? null : playbackFromSpeed(speed);
  if (playback) {
    state.playback = params.get('paused') === '1' ? { ...playback, playing: false } : playback;
  }

  return state;
}

/** Minute precision keeps links short and stable. */
const toIsoMinute = (ms: number): string => `${new Date(ms).toISOString().slice(0, 16)}Z`;

const round = (n: number): string => String(Math.round(n * 1e4) / 1e4);

export function serializeUrlState({ location, timeMs, playback }: Required<UrlState>): string {
  const params = new URLSearchParams();
  if (location.id === 'custom') {
    params.set('lat', round(location.latitude));
    params.set('lon', round(location.longitude));
    if (location.label !== CUSTOM_LABEL) params.set('name', location.label);
  } else {
    params.set('loc', location.id);
  }
  params.set('t', toIsoMinute(timeMs));
  // The step's speed even while paused, so play resumes at the same speed.
  params.set('speed', String(playbackSpeed({ ...playback, playing: true })));
  if (!playback.playing) params.set('paused', '1');
  return `?${params.toString()}`;
}
