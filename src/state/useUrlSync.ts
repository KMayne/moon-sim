import { useEffect } from 'react';
import { useSimStore } from './store';
import { serializeUrlState } from './urlState';

const SYNC_INTERVAL_MS = 1000;

/**
 * Keeps the address bar a shareable link to what's on screen (location, sim time, speed).
 * Polled, not per frame: sim time changes continuously and replaceState is not free.
 */
export function useUrlSync(): void {
  useEffect(() => {
    let last = '';
    const sync = () => {
      const { clock, playback, location } = useSimStore.getState();
      const search = serializeUrlState({ location, timeMs: clock.nowMs(), playback });
      if (search !== last) {
        last = search;
        window.history.replaceState(window.history.state, '', search);
      }
    };
    const id = setInterval(sync, SYNC_INTERVAL_MS);
    return () => {
      clearInterval(id);
    };
  }, []);
}
