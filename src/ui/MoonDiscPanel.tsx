import { ChevronRight } from 'lucide-react';
import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { DiscView } from '../scene/disc/DiscView';
import sectionClasses from './controls/Section.module.css';
import { clampDiscSize, DISC_SIZE, dragDiscSize } from './discSize';
import { formatPercent } from './format';
import type { HudSnapshot } from './hudModel';
import styles from './MoonDiscPanel.module.css';
import { usePersistentFlag } from './usePersistentFlag';

const SIZE_KEY = 'moon-sim:moon-disc-size';

function readStoredSize(): number {
  try {
    const n = Number(window.localStorage.getItem(SIZE_KEY));
    return Number.isFinite(n) && n > 0 ? n : DISC_SIZE.default;
  } catch {
    return DISC_SIZE.default;
  }
}

function storeSize(size: number): void {
  try {
    window.localStorage.setItem(SIZE_KEY, String(size));
  } catch {
    // Not remembered this time; the in-memory size still applies.
  }
}

/**
 * The magnified Moon as this observer sees it, with its phase, docked to the sky view's bottom-right
 * edge and resizable by dragging its left edge. The disc is a 3D view in the shared canvas; the chrome
 * here sits above it. Collapsed, the view is unmounted and the header still shows the phase.
 *
 * While open it publishes its width as `--moon-disc-width` on the views container so the transport
 * bar can centre itself in the remaining space.
 */
export function MoonDiscPanel({ snap }: { snap: HudSnapshot }) {
  const [open, setOpen] = usePersistentFlag('moon-sim:panel:moon-disc', false);
  const [requested, setRequested] = useState(readStoredSize);
  const [host, setHost] = useState({ width: 0, height: 0 });
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<{ x: number; size: number } | null>(null);
  const bodyId = useId();

  // Track the host view's size so the disc always fits.
  useEffect(() => {
    const view = panel.current?.parentElement;
    if (!view) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHost({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(view);
    return () => {
      observer.disconnect();
    };
  }, []);

  const size = host.width > 0 ? clampDiscSize(requested, host.width, host.height) : requested;

  useEffect(() => {
    const views = panel.current?.closest<HTMLElement>('.views');
    if (!views) return;
    views.style.setProperty('--moon-disc-width', open ? `${size}px` : '0px');
    return () => {
      views.style.removeProperty('--moon-disc-width');
    };
  }, [open, size]);

  const commit = (next: number) => {
    setRequested(next);
    storeSize(next);
  };

  const onGripDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, size };
  };
  const onGripMove = (e: PointerEvent<HTMLButtonElement>) => {
    const start = drag.current;
    if (!start) return;
    setRequested(dragDiscSize(start.size, e.clientX - start.x));
  };
  const onGripUp = () => {
    if (!drag.current) return;
    drag.current = null;
    commit(size);
  };

  const below = snap.moonAltitudeDeg < 0;
  const phase = `${snap.phase.phaseName} · ${formatPercent(snap.phase.illuminatedFraction)}`;

  return (
    <section
      ref={panel}
      className={styles.panel}
      data-open={open || undefined}
      style={open ? ({ width: `${size}px` } satisfies CSSProperties) : undefined}
      aria-label="Moon as seen from the observer"
    >
      {open && (
        <button
          type="button"
          className={styles.grip}
          aria-label="Resize Moon view (drag, or use left and right arrow keys)"
          title="Drag to resize"
          onPointerDown={onGripDown}
          onPointerMove={onGripMove}
          onPointerUp={onGripUp}
          onPointerCancel={onGripUp}
          onKeyDown={(e) => {
            const step = { ArrowLeft: 1, ArrowRight: -1 }[e.key];
            if (step === undefined) return;
            e.preventDefault();
            commit(clampDiscSize(size + step * DISC_SIZE.keyboardStep, host.width, host.height));
          }}
        />
      )}
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
          {/* Below the horizon the disc is shown dimmed: you couldn't see it from here. */}
          {below && <div className={styles.dim} aria-hidden />}
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
