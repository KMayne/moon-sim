import { describe, expect, it } from 'vitest';
import { customLocation, LOCATION_PRESETS } from './locations';
import { parseUrlState, serializeUrlState } from './urlState';

const SPEEDS = [0, 1, 60, 3600, 86_400];

describe('parseUrlState', () => {
  it('reads a preset, time and speed', () => {
    expect(parseUrlState('?loc=paranal&t=2026-06-21T12:00Z&speed=-3600', SPEEDS)).toEqual({
      location: LOCATION_PRESETS.paranal,
      timeMs: Date.UTC(2026, 5, 21, 12),
      speed: -3600,
    });
  });

  it('reads a custom location, normalising it', () => {
    expect(parseUrlState('?lat=51.5&lon=359.9', SPEEDS).location).toEqual(
      customLocation(51.5, -0.1),
    );
  });

  it('ignores invalid or unsupported values field by field', () => {
    expect(parseUrlState('?loc=atlantis&t=yesterday&speed=7', SPEEDS)).toEqual({});
    expect(parseUrlState('?lat=95&lon=0', SPEEDS)).toEqual({});
    expect(parseUrlState('?lat=10', SPEEDS)).toEqual({});
    expect(parseUrlState('?t=1800-01-01T00:00Z', SPEEDS)).toEqual({});
    expect(parseUrlState('?speed=', SPEEDS)).toEqual({});
  });

  it('prefers a valid preset over lat/lon', () => {
    expect(parseUrlState('?loc=tromso&lat=1&lon=2', SPEEDS).location).toBe(LOCATION_PRESETS.tromso);
  });
});

describe('serializeUrlState', () => {
  it('round-trips presets and custom locations', () => {
    for (const location of [LOCATION_PRESETS['mauna-kea'], customLocation(-33.8688, 151.2093)]) {
      const state = { location, timeMs: Date.UTC(2026, 9, 11, 22, 30), speed: 60 };
      expect(parseUrlState(serializeUrlState(state), SPEEDS)).toEqual(state);
    }
  });

  it('rounds time to the minute', () => {
    const search = serializeUrlState({
      location: LOCATION_PRESETS.tromso,
      timeMs: Date.UTC(2026, 0, 1, 0, 0, 59, 999),
      speed: 1,
    });
    expect(search).toContain('t=2026-01-01T00%3A00Z');
  });
});
