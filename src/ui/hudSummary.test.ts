import { describe, expect, it } from 'vitest';
import type { HorizonEvent } from '../astro/events';
import { hudSummary } from './hudSummary';

const at = (iso: string): HorizonEvent => ({ found: true, timeMs: Date.parse(iso) });
const phase = { phaseName: 'Waxing Gibbous', illuminatedFraction: 0.894, sunEarthMoonDeg: 140 };

const summary = (rise: HorizonEvent, set: HorizonEvent) =>
  hudSummary({ phase: phase as never, riseSet: { rise, set }, zone: 'UTC' });

describe('hudSummary', () => {
  it('names the next horizon event', () => {
    // 2026-07-01 is a Wednesday.
    expect(summary(at('2026-07-01T13:08Z'), at('2026-07-02T03:00Z'))).toBe(
      'Waxing Gibbous · 89.4% · rises Wed 13:08',
    );
    expect(summary(at('2026-07-02T13:08Z'), at('2026-07-01T03:00Z'))).toBe(
      'Waxing Gibbous · 89.4% · sets Wed 03:00',
    );
  });

  it('explains when neither event happens in the window', () => {
    const up: HorizonEvent = { found: false, reason: 'circumpolar' };
    expect(summary(up, up)).toBe('Waxing Gibbous · 89.4% · up for the next 48 h');
  });

  it('uses whichever event exists when only one is in the window', () => {
    const none: HorizonEvent = { found: false, reason: 'none-in-window' };
    expect(summary(none, at('2026-07-01T03:00Z'))).toBe('Waxing Gibbous · 89.4% · sets Wed 03:00');
  });
});
