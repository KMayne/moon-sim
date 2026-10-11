import { ChevronRight } from 'lucide-react';
import { useId } from 'react';
import { DiscView } from '../scene/disc/DiscView';
import sectionClasses from './controls/Section.module.css';
import { formatPercent } from './format';
import type { HudSnapshot } from './hudModel';
import styles from './MoonDiscPanel.module.css';
import { usePersistentFlag } from './usePersistentFlag';

/**
 * The magnified Moon as this observer sees it, with its phase. The disc itself is a 3D view in the
 * shared canvas; the labels here sit above it. Collapsed, the view is unmounted (nothing to render)
 * and the header still shows the phase.
 */
export function MoonDiscPanel({ snap }: { snap: HudSnapshot }) {
  const [open, setOpen] = usePersistentFlag('moon-sim:panel:moon-disc', false);
  const bodyId = useId();
  const below = snap.moonAltitudeDeg < 0;
  const phase = `${snap.phase.phaseName} · ${formatPercent(snap.phase.illuminatedFraction)}`;

  return (
    <section
      className={styles.panel}
      data-open={open || undefined}
      aria-label="Moon as seen from the observer"
    >
      <button
        type="button"
        className={`${sectionClasses.header ?? ''} ${styles.header ?? ''}`}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => {
          setOpen(!open);
        }}
      >
        <ChevronRight
          size={14}
          aria-hidden
          className={sectionClasses.chevron}
          data-open={open || undefined}
        />
        <span className={styles.title}>Moon</span>
        <span className={styles.phase}>{phase}</span>
      </button>
      {open && (
        <div id={bodyId} className={styles.body}>
          <DiscView className={styles.disc ?? ''} />
          <div className={styles.overlay}>
            <span className={styles.zenith} title="Up in this view is the observer's zenith">
              ↑ zenith
            </span>
            {below && (
              <span className={styles.below}>Below horizon — shown as it would appear</span>
            )}
          </div>
          <p className={styles.caption}>as seen from {snap.location.label}, magnified</p>
        </div>
      )}
    </section>
  );
}
