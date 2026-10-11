import { describe, expect, it } from 'vitest';
import { fromZonedString, toZonedString, zoneOffsetMs } from './zonedTime';

const H = 3_600_000;

describe('zonedTime', () => {
  it('knows CET/CEST and Chile offsets', () => {
    expect(zoneOffsetMs(Date.UTC(2026, 0, 15), 'Europe/Oslo')).toBe(H);
    expect(zoneOffsetMs(Date.UTC(2026, 6, 15), 'Europe/Oslo')).toBe(2 * H);
    expect(zoneOffsetMs(Date.UTC(2026, 6, 15), 'Pacific/Honolulu')).toBe(-10 * H);
  });

  it('formats an instant as local wall-clock time', () => {
    expect(toZonedString(Date.UTC(2026, 9, 11, 20, 30, 5), 'Europe/Oslo')).toBe(
      '2026-10-11 22:30:05',
    );
  });

  it('round-trips through local time across zones and seasons', () => {
    for (const zone of ['Europe/Oslo', 'America/Santiago', 'Pacific/Honolulu', 'UTC']) {
      for (const ms of [Date.UTC(2026, 0, 1, 12), Date.UTC(2026, 6, 1, 3, 15)]) {
        expect(fromZonedString(toZonedString(ms, zone), zone)).toBe(ms);
      }
    }
  });

  it('accepts minutes-only input and rejects junk', () => {
    expect(fromZonedString('2026-10-11 22:30', 'Europe/Oslo')).toBe(Date.UTC(2026, 9, 11, 20, 30));
    expect(fromZonedString('yesterday', 'UTC')).toBeNull();
  });

  it('shifts a time inside the spring-forward gap forward', () => {
    // 2026-03-29 02:30 does not exist in Oslo (clocks jump 02:00 → 03:00).
    const ms = fromZonedString('2026-03-29 02:30', 'Europe/Oslo');
    expect(ms).not.toBeNull();
    expect(toZonedString(ms ?? 0, 'Europe/Oslo')).toBe('2026-03-29 03:30:00');
  });
});
