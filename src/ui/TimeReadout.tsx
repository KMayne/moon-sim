import { useEffect, useState } from 'react';
import { useSimStore } from '../state/store';
import { isSpinAliased } from './speeds';

const READOUT_INTERVAL_MS = 250;

const formatUtc = (ms: number): string =>
  `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`;

/** Sim time display, polled at a few Hz rather than per frame. */
export function TimeReadout() {
  const clock = useSimStore((s) => s.clock);
  const speed = useSimStore((s) => s.speed);
  const [simMs, setSimMs] = useState(() => clock.nowMs());

  useEffect(() => {
    const id = setInterval(() => {
      setSimMs(clock.nowMs());
    }, READOUT_INTERVAL_MS);
    return () => {
      clearInterval(id);
    };
  }, [clock]);

  return (
    <div className="time-readout">
      <div className="time-readout__time">{formatUtc(simMs)}</div>
      {isSpinAliased(speed) && (
        <div className="time-readout__notice">
          Earth's spin is too fast to show at this speed — what you see is strobing. Positions
          remain exact.
        </div>
      )}
    </div>
  );
}
