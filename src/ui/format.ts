import tzLookup from '@photostructure/tz-lookup';
import type { HorizonEvent } from '../astro/events';
import type { ObserverLocation } from '../state/locations';

/** IANA time zone at a location (sea locations get nautical zones such as Etc/GMT+10). */
export function zoneFor(location: Pick<ObserverLocation, 'latitude' | 'longitude'>): string {
  return tzLookup(location.latitude, location.longitude);
}

export const formatUtc = (ms: number): string =>
  `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(zone: string, kind: 'datetime' | 'event'): Intl.DateTimeFormat {
  const key = `${kind}|${zone}`;
  let f = formatters.get(key);
  if (!f) {
    f =
      kind === 'datetime'
        ? new Intl.DateTimeFormat('en-GB', {
            timeZone: zone,
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
            timeZoneName: 'short',
          })
        : new Intl.DateTimeFormat('en-GB', {
            timeZone: zone,
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
          });
    formatters.set(key, f);
  }
  return f;
}

/** e.g. "11 Oct 2026, 16:05 CEST" */
export const formatLocal = (ms: number, zone: string): string =>
  formatter(zone, 'datetime').format(ms);

/** e.g. "Mon 16:05", or why there is no event. */
export function formatEvent(event: HorizonEvent, zone: string): string {
  if (event.found) return formatter(zone, 'event').format(event.timeMs);
  switch (event.reason) {
    // The search only looks 48 h ahead, so say exactly that rather than "all day"/"always".
    case 'circumpolar':
      return 'Up for the next 48 h';
    case 'never-rises':
      return 'Down for the next 48 h';
    case 'none-in-window':
      return '—';
  }
}

export const formatPercent = (fraction: number): string => `${(fraction * 100).toFixed(1)}%`;

export const formatDays = (days: number): string => `${days.toFixed(1)} d`;

export const formatDegrees = (deg: number): string => `${deg.toFixed(1)}°`;
