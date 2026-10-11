import { Button } from '@mantine/core';
import { useSimStore } from '../state/store';
import {
  formatLatLon,
  lunarTitle,
  solarTitle,
  watchGlobalSolar,
  watchLocalSolar,
  watchLunar,
  type WatchPlan,
} from './eclipseWatch';
import { formatLocal, formatPercent } from './format';
import styles from './Hud.module.css';
import type { HudEclipses } from './hudModel';

const LUNAR_VISIBILITY = {
  visible: 'visible from here',
  'partly visible': 'partly visible from here',
  'below horizon': 'Moon below the horizon here',
} as const;

interface ItemProps {
  heading: string;
  title: string;
  when: string;
  note: string;
  watch: WatchPlan;
}

function EclipseItem({ heading, title, when, note, watch }: ItemProps) {
  const setTime = useSimStore((s) => s.setTime);
  const setPlayback = useSimStore((s) => s.setPlayback);
  return (
    <li className={styles.eclipse}>
      <div className={styles.eclipseText}>
        <span className={styles.eclipseHeading}>{heading}</span>
        <span>{title}</span>
        <span className={styles.eclipseWhen}>{when}</span>
        <span className={styles.eclipseNote}>{note}</span>
      </div>
      <Button
        variant="light"
        size="compact-xs"
        onClick={() => {
          setTime(new Date(watch.timeMs));
          setPlayback(watch.playback);
        }}
        title="Jump to just before it starts and play at 10 min/s"
      >
        Watch
      </Button>
    </li>
  );
}

/** Next lunar eclipse, next solar eclipse visible from here, and next solar eclipse anywhere. */
export function EclipseList({ eclipses, zone }: { eclipses: HudEclipses; zone: string }) {
  const { lunar, localSolar, globalSolar } = eclipses;
  return (
    <ul className={styles.eclipses} aria-label="Upcoming eclipses">
      <EclipseItem
        heading="Next lunar"
        title={lunarTitle(lunar)}
        when={formatLocal(lunar.peakMs, zone)}
        note={LUNAR_VISIBILITY[lunar.visibility]}
        watch={watchLunar(lunar)}
      />
      {localSolar ? (
        <EclipseItem
          heading="Next solar from here"
          title={solarTitle(localSolar)}
          when={formatLocal(localSolar.peakMs, zone)}
          note={`${formatPercent(localSolar.obscuration)} of the Sun covered`}
          watch={watchLocalSolar(localSolar)}
        />
      ) : (
        <li className={styles.eclipseNote}>No solar eclipse visible from here for decades.</li>
      )}
      <EclipseItem
        heading="Next solar anywhere"
        title={solarTitle(globalSolar)}
        when={formatLocal(globalSolar.peakMs, zone)}
        note={
          globalSolar.latitude !== undefined && globalSolar.longitude !== undefined
            ? `greatest at ${formatLatLon(globalSolar.latitude, globalSolar.longitude)}`
            : 'greatest eclipse near a pole'
        }
        watch={watchGlobalSolar(globalSolar)}
      />
    </ul>
  );
}
