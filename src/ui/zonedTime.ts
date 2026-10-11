/**
 * Conversions between UTC instants and wall-clock strings ("YYYY-MM-DD HH:mm:ss", the format
 * Mantine's date pickers use) in an IANA time zone, via Intl. Used so the time picker works in
 * the observer's local time.
 */

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(zone: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatters.set(zone, f);
  }
  return f;
}

/** Wall-clock fields of `ms` in `zone`. */
function wallClock(ms: number, zone: string): Record<string, number> {
  const fields: Record<string, number> = {};
  for (const p of partsFormatter(zone).formatToParts(ms)) {
    if (p.type !== 'literal') fields[p.type] = Number(p.value);
  }
  return fields;
}

/** Offset of `zone` from UTC at instant `ms`, in ms (e.g. +3_600_000 for CET). */
export function zoneOffsetMs(ms: number, zone: string): number {
  const f = wallClock(ms, zone);
  const asUtc = Date.UTC(
    f.year ?? 1970,
    (f.month ?? 1) - 1,
    f.day ?? 1,
    f.hour ?? 0,
    f.minute ?? 0,
    f.second ?? 0,
  );
  return asUtc - Math.floor(ms / 1000) * 1000;
}

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

/** UTC instant → "YYYY-MM-DD HH:mm:ss" wall-clock time in `zone`. */
export function toZonedString(ms: number, zone: string): string {
  const f = wallClock(ms, zone);
  return `${pad(f.year ?? 0, 4)}-${pad(f.month ?? 1)}-${pad(f.day ?? 1)} ${pad(f.hour ?? 0)}:${pad(f.minute ?? 0)}:${pad(f.second ?? 0)}`;
}

/**
 * "YYYY-MM-DD HH:mm[:ss]" wall-clock time in `zone` → UTC instant, or null if unparseable.
 * In a DST gap the time is shifted forward; in an overlap the earlier instant wins.
 */
export function fromZonedString(text: string, zone: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s = '0'] = m;
  const naive = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  if (Number.isNaN(naive)) return null;
  // Two passes settle the offset across DST transitions.
  let ms = naive - zoneOffsetMs(naive, zone);
  ms = naive - zoneOffsetMs(ms, zone);
  return ms;
}
