import { describe, expect, it } from 'vitest';
import type { LunarEclipse } from '../astro/eclipses';
import { playbackSpeed } from '../sim/playback';
import type { GlobalSolarEclipse } from '../astro/eclipses';
import { formatLatLon, greatestEclipseLocation, inProgressText, watchLunar } from './eclipseWatch';

const MIN = 60_000;
const peak = Date.UTC(2026, 2, 3, 11, 33);
const total: LunarEclipse = {
  kind: 'total',
  peakMs: peak,
  startMs: peak - 170 * MIN,
  endMs: peak + 170 * MIN,
  partialStartMs: peak - 100 * MIN,
  partialEndMs: peak + 100 * MIN,
  totalStartMs: peak - 30 * MIN,
  totalEndMs: peak + 30 * MIN,
  obscuration: 1,
  visibility: 'visible',
};

describe('eclipse watching', () => {
  it('starts just before the umbra arrives, playing forwards at 10 min/s', () => {
    const w = watchLunar(total);
    expect(w.timeMs).toBe(peak - 115 * MIN);
    expect(playbackSpeed(w.playback)).toBe(600);
  });

  it('falls back to the penumbra for penumbral-only eclipses', () => {
    const penumbral: LunarEclipse = {
      kind: 'penumbral',
      peakMs: peak,
      startMs: peak - 170 * MIN,
      endMs: peak + 170 * MIN,
      obscuration: 0,
      visibility: 'visible',
    };
    expect(watchLunar(penumbral).timeMs).toBe(peak - 185 * MIN);
  });

  it('formats coordinates and in-progress text', () => {
    expect(formatLatLon(65.2155, -25.2494)).toBe('65.2°N 25.2°W');
    expect(inProgressText({ body: 'moon', stage: 'total', eclipse: total })).toBe(
      'Total lunar eclipse in progress',
    );
  });

  it('watches a solar eclipse from its point of greatest eclipse, when there is one', () => {
    const e = {
      kind: 'total',
      peakMs: peak,
      latitude: 65.2,
      longitude: -25.2,
    } as GlobalSolarEclipse;
    const there = greatestEclipseLocation(e);
    expect(there?.latitude).toBe(65.2);
    expect(there?.longitude).toBeCloseTo(-25.2, 9);
    expect(greatestEclipseLocation({ kind: 'total', peakMs: peak })).toBeUndefined();
  });
});
