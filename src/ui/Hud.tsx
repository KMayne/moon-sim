import { useId } from 'react';
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
import { hudSummary } from './hudSummary';
import { usePersistentFlag } from './usePersistentFlag';

const EXPANDED_KEY = 'moon-sim:hud-expanded';

/**
 * Moon and observer readouts for one snapshot (see useHudSnapshot). Starts collapsed to a one-line
 * summary; the viewer's choice is remembered.
 */
export function Hud({ snap }: { snap: HudSnapshot }) {
  const [expanded, setExpanded] = usePersistentFlag(EXPANDED_KEY, false);
  const detailsId = useId();

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
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => {
            setExpanded(!expanded);
          }}
        >
          <span className={styles.chevron} aria-hidden="true" />
          <span>
            Moon <span className={styles.where}>from {snap.location.label}</span>
          </span>
        </button>
      </h2>
      {!expanded && <p className={styles.summary}>{hudSummary(snap)}</p>}
      <div id={detailsId} className={styles.details} data-expanded={expanded} inert={!expanded}>
        <div className={styles.detailsInner}>
          <dl className={styles.rows}>
            {rows.map(([label, value]) => (
              <div key={label} className={styles.row}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className={styles.note}>
            Rise/set: next within 48 h, observer local time ({snap.zone}).
          </p>
        </div>
      </div>
    </section>
  );
}
