import {
  formatDays,
  formatDegrees,
  formatEvent,
  formatLocal,
  formatPercent,
  formatUtc,
} from './format';
import styles from './Hud.module.css';
import type { HudSnapshot } from './hudModel';

/** Moon and observer readouts for one snapshot (see useHudSnapshot). */
export function Hud({ snap }: { snap: HudSnapshot }) {
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
