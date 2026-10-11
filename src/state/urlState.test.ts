import { describe, expect, it } from 'vitest';
import { TRUE_SCALE } from '../sim/visualScale';
import { customLocation, LOCATION_PRESETS } from './locations';
import { parseUrlState, serializeUrlState } from './urlState';

describe('parseUrlState', () => {
  it('reads a preset, time and speed', () => {
    expect(parseUrlState('?loc=paranal&t=2026-06-21T12:00Z&speed=-3600')).toEqual({
      location: LOCATION_PRESETS.paranal,
      timeMs: Date.UTC(2026, 5, 21, 12),
      playback: { playing: true, reverse: true, step: 3 },
    });
  });

  it('reads a custom location, normalising it', () => {
    expect(parseUrlState('?lat=51.5&lon=359.9').location).toEqual(customLocation(51.5, -0.1));
  });

  it('ignores invalid or unsupported values field by field', () => {
    expect(parseUrlState('?loc=atlantis&t=yesterday&speed=7')).toEqual({});
    expect(parseUrlState('?lat=95&lon=0')).toEqual({});
    expect(parseUrlState('?lat=10')).toEqual({});
    expect(parseUrlState('?t=1800-01-01T00:00Z')).toEqual({});
    expect(parseUrlState('?speed=')).toEqual({});
  });

  it('prefers a valid preset over lat/lon', () => {
    expect(parseUrlState('?loc=tromso&lat=1&lon=2').location).toBe(LOCATION_PRESETS.tromso);
  });
});

describe('settings in links', () => {
  it('reads the visual aids, filling the other with true scale', () => {
    expect(parseUrlState('?size=10').visualScale).toEqual({ bodySize: 10, moonDistance: 1 });
    expect(parseUrlState('?dist=0.1').visualScale).toEqual({ bodySize: 1, moonDistance: 0.1 });
  });

  it('ignores out-of-range or invalid settings', () => {
    expect(parseUrlState('?size=100&dist=2&focus=sun&aurora=yes')).toEqual({});
  });

  it('reads orbit focus and aurora', () => {
    expect(parseUrlState('?focus=moon&aurora=1')).toEqual({
      orbitFocus: 'moon',
      auroraEnabled: true,
    });
  });
});

describe('playback in links', () => {
  it('treats speed=0 from older links as paused at the default speed', () => {
    expect(parseUrlState('?speed=0').playback).toMatchObject({ playing: false, step: 3 });
  });

  it('keeps the speed step while paused', () => {
    expect(parseUrlState('?speed=86400&paused=1').playback).toEqual({
      playing: false,
      reverse: false,
      step: 5,
    });
  });
});

describe('serializeUrlState', () => {
  it('round-trips presets and custom locations', () => {
    for (const location of [
      LOCATION_PRESETS['mauna-kea'],
      customLocation(-33.8688, 151.2093),
      customLocation(64.1466, -21.9426, 'Reykjavík, Iceland'),
    ]) {
      const state = {
        location,
        timeMs: Date.UTC(2026, 9, 11, 22, 30),
        playback: { playing: false, reverse: true, step: 1 },
        visualScale: { bodySize: 12.5, moonDistance: 0.25 },
        orbitFocus: 'moon' as const,
        auroraEnabled: true,
      };
      expect(parseUrlState(serializeUrlState(state))).toEqual(state);
    }
  });

  it('rounds time to the minute', () => {
    const search = serializeUrlState({
      location: LOCATION_PRESETS.tromso,
      timeMs: Date.UTC(2026, 0, 1, 0, 0, 59, 999),
      playback: { playing: true, reverse: false, step: 0 },
      visualScale: TRUE_SCALE,
      orbitFocus: 'earth',
      auroraEnabled: false,
    });
    expect(search).toContain('t=2026-01-01T00%3A00Z');
  });

  it('leaves default settings out of the link', () => {
    const search = serializeUrlState({
      location: LOCATION_PRESETS.tromso,
      timeMs: Date.UTC(2026, 0, 1),
      playback: { playing: true, reverse: false, step: 3 },
      visualScale: TRUE_SCALE,
      orbitFocus: 'earth',
      auroraEnabled: false,
    });
    expect(search).not.toMatch(/size=|dist=|focus=|aurora=/);
  });
});
