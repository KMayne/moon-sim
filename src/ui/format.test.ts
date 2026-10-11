import { describe, expect, it } from 'vitest';
import { LOCATION_PRESETS } from '../state/locations';
import { formatEvent, formatLocal, zoneFor } from './format';

describe('zoneFor', () => {
  it('finds the IANA zone for each preset', () => {
    expect(zoneFor(LOCATION_PRESETS.tromso)).toBe('Europe/Oslo');
    expect(zoneFor(LOCATION_PRESETS['mauna-kea'])).toBe('Pacific/Honolulu');
    expect(zoneFor(LOCATION_PRESETS.paranal)).toBe('America/Santiago');
  });
});

describe('formatLocal', () => {
  const noonUtc = Date.UTC(2026, 6, 1, 12, 0);

  it('applies the zone offset, including DST', () => {
    expect(formatLocal(noonUtc, 'Europe/Oslo')).toContain('14:00'); // CEST, UTC+2
    expect(formatLocal(Date.UTC(2026, 0, 1, 12), 'Europe/Oslo')).toContain('13:00'); // CET
    expect(formatLocal(noonUtc, 'Pacific/Honolulu')).toContain('02:00'); // HST, UTC−10
  });
});

describe('formatEvent', () => {
  it('formats found events in local time and explains missing ones', () => {
    const t = Date.UTC(2026, 6, 1, 12, 0); // a Wednesday
    expect(formatEvent({ found: true, timeMs: t }, 'Europe/Oslo')).toBe('Wed 14:00');
    expect(formatEvent({ found: false, reason: 'circumpolar' }, 'UTC')).toBe('Circumpolar');
    expect(formatEvent({ found: false, reason: 'never-rises' }, 'UTC')).toBe(
      'Below horizon all day',
    );
    expect(formatEvent({ found: false, reason: 'none-in-window' }, 'UTC')).toBe('—');
  });
});
