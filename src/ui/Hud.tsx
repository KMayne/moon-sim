import { useEffect, useState } from 'react';
import { useSimStore } from '../state/store';
import {
  formatDays,
  formatDegrees,
  formatEvent,
  formatLocal,
  formatPercent,
  formatUtc,
} from './format';
import styles from './Hud.module.css';
import { createHudCaches, hudSnapshot, type HudSnapshot } from './hudModel';

const HUD_INTERVAL_MS = 250;

/** Moon and observer readouts, polled at a few Hz; never updated per frame. */
export function Hud() {
  const clock = useSimStore((s) => s.clock);
  const location = useSimStore((s) => s.location);
  const [caches] = useState(createHudCaches);
  const [snap, setSnap] = useState<HudSnapshot>(() => hudSnapshot(clock.nowMs(), location, caches));

  useEffect(() => {
    const id = setInterval(() => {
      setSnap(hudSnapshot(clock.nowMs(), location, caches));
    }, HUD_INTERVAL_MS);
    return () => {
      clearInterval(id);
    };
  }, [clock, location, caches]);

  const rows: [string, string][] = [
    ['UTC', formatUtc(snap.simMs)],
    ['Local', formatLocal(snap.simMs, snap.zone)],
    ['Phase', snap.phase.phaseName],
    ['Illuminated', formatPercent(snap.phase.illuminatedFraction)],
    ['Age', formatDays(snap.ageDays)],
    ['Sun–Earth–Moon', formatDegrees(snap.phase.sunEarthMoonDeg)],
    ['Moonrise', formatEvent(snap.riseSet.rise, snap.zone)],
    ['Moonset', formatEvent(snap.riseSet.set, snap.zone)],
  ];

  return (
    <section className={styles.hud} aria-label="Moon status">
      <h2 className={styles.title}>
        Moon <span className={styles.where}>from {snap.location.label}</span>
      </h2>
      <dl className={styles.rows}>
        {rows.map(([label, value]) => (
          <div key={label} className={styles.row}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.note}>Rise/set: next within 48 h, observer local time ({snap.zone}).</p>
    </section>
  );
}
