import { ArrowLeftRight, ChevronsLeft, ChevronsRight, Pause, Play } from 'lucide-react';
import { useEffect } from 'react';
import { SPEED_STEPS, speedLabel } from '../sim/playback';
import { useSimStore } from '../state/store';
import { SimTimePicker } from './SimTimePicker';
import styles from './Transport.module.css';

/** Keys are ignored while typing in a field (e.g. the "go to" date or coordinates). */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/** Space: play/pause · [ / ]: slower/faster · R: reverse. */
function useTransportKeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const s = useSimStore.getState();
      const action = {
        ' ': s.togglePlaying,
        '[': s.slower,
        ']': s.faster,
        r: s.toggleReverse,
        R: s.toggleReverse,
      }[e.key];
      if (!action) return;
      // Also stops a focused button from "clicking" on Space: Space always means play/pause.
      e.preventDefault();
      if (!e.repeat) action();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' && e.target instanceof HTMLButtonElement) e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);
}

/** Sim time, play/pause, direction and speed: everything that drives the sim clock. */
export function Transport() {
  const playback = useSimStore((s) => s.playback);
  const togglePlaying = useSimStore((s) => s.togglePlaying);
  const faster = useSimStore((s) => s.faster);
  const slower = useSimStore((s) => s.slower);
  const toggleReverse = useSimStore((s) => s.toggleReverse);
  useTransportKeys();

  const atSlowest = playback.step <= 0;
  const atFastest = playback.step >= SPEED_STEPS.length - 1;

  return (
    <div className={styles.transport} role="group" aria-label="Time controls">
      <button
        type="button"
        className={styles.button}
        aria-pressed={playback.reverse}
        onClick={toggleReverse}
        title="Reverse (R)"
      >
        <ArrowLeftRight size={18} aria-hidden />
        <span className={styles.srOnly}>Reverse</span>
      </button>
      <button
        type="button"
        className={styles.button}
        onClick={slower}
        disabled={atSlowest}
        title="Slower ([)"
      >
        <ChevronsLeft size={20} aria-hidden />
        <span className={styles.srOnly}>Slower</span>
      </button>
      <button
        type="button"
        className={`${styles.button} ${styles.play}`}
        onClick={togglePlaying}
        title={playback.playing ? 'Pause (Space)' : 'Play (Space)'}
      >
        {playback.playing ? (
          <Pause size={20} fill="currentColor" aria-hidden />
        ) : (
          <Play size={20} fill="currentColor" aria-hidden />
        )}
        <span className={styles.srOnly}>{playback.playing ? 'Pause' : 'Play'}</span>
      </button>
      <button
        type="button"
        className={styles.button}
        onClick={faster}
        disabled={atFastest}
        title="Faster (])"
      >
        <ChevronsRight size={20} aria-hidden />
        <span className={styles.srOnly}>Faster</span>
      </button>
      <span className={styles.speed} aria-live="polite">
        {playback.playing ? speedLabel(playback) : `Paused · ${speedLabel(playback)}`}
      </span>
      <div className={styles.time}>
        <SimTimePicker />
      </div>
    </div>
  );
}
