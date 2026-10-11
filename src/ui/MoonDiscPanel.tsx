import { DiscView } from '../scene/disc/DiscView';
import { formatPercent } from './format';
import type { HudSnapshot } from './hudModel';
import styles from './MoonDiscPanel.module.css';

/**
 * The magnified Moon as this observer sees it, with its phase. The disc itself is a 3D view in the
 * shared canvas; the labels here sit above it.
 */
export function MoonDiscPanel({ snap }: { snap: HudSnapshot }) {
  const below = snap.moonAltitudeDeg < 0;
  return (
    <section className={styles.panel} aria-label="Moon as seen from the observer">
      <DiscView className={styles.disc ?? ''} />
      <div className={styles.overlay}>
        <span className={styles.zenith} title="Up in this view is the observer's zenith">
          ↑ zenith
        </span>
        {below && <span className={styles.below}>Below horizon — shown as it would appear</span>}
      </div>
      <p className={styles.caption}>
        <span className={styles.phase}>
          {snap.phase.phaseName} · {formatPercent(snap.phase.illuminatedFraction)}
        </span>
        <br />
        as seen from {snap.location.label}, magnified
      </p>
    </section>
  );
}
