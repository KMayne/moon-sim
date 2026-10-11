import type { HorizonEvent } from '../astro/events';
import { formatEvent, formatPercent } from './format';
import type { HudSnapshot } from './hudModel';

const timeOf = (e: HorizonEvent): number => (e.found ? e.timeMs : Infinity);

/**
 * One line for the collapsed HUD, e.g. "Waxing Gibbous · 89.4% · rises Mon 13:08": phase, lit
 * fraction and whichever horizon event comes next (or why there isn't one).
 */
export function hudSummary(snap: Pick<HudSnapshot, 'phase' | 'riseSet' | 'zone'>): string {
  const { rise, set } = snap.riseSet;
  const parts = [snap.phase.phaseName, formatPercent(snap.phase.illuminatedFraction)];
  if (rise.found || set.found) {
    parts.push(
      timeOf(rise) <= timeOf(set)
        ? `rises ${formatEvent(rise, snap.zone)}`
        : `sets ${formatEvent(set, snap.zone)}`,
    );
  } else {
    // Neither event in the window: say why (e.g. "up for the next 48 h"), unless there's no reason.
    const reason = formatEvent(rise, snap.zone);
    if (reason !== '—') parts.push(reason.toLowerCase());
  }
  return parts.join(' · ');
}
