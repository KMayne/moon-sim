import { X } from 'lucide-react';
import { useState } from 'react';
import { isTrueScale, resolveVisualScale } from '../sim/visualScale';
import { useSimStore } from '../state/store';

const fmt = (x: number): string => `${Number(x.toFixed(2))}×`;

/**
 * Shown while any visual aid is on, so a scaled view is never mistaken for true scale. It can be
 * dismissed, but only for the scale it was showing: change the scale and it comes back.
 * On phones it shrinks to one short line (see index.css), dropping the `--long` parts.
 */
export function ScaleBadge() {
  const requested = useSimStore((s) => s.visualScale);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const applied = resolveVisualScale(requested);
  if (isTrueScale(applied)) return null;

  const key = `${applied.bodySize}/${applied.moonDistance}`;
  if (dismissedFor === key) return null;

  const raised = applied.moonDistance > requested.moonDistance;
  return (
    <div className="scale-badge" role="status">
      <div className="scale-badge__text">
        <strong>
          <span className="scale-badge--long">Visual aid active: not</span>
          <span className="scale-badge--short">Not</span> to scale
        </strong>
        <span>
          <span className="scale-badge--long">Body size</span>
          <span className="scale-badge--short">size</span> {fmt(applied.bodySize)}, distance{' '}
          {fmt(applied.moonDistance)}
          {raised && <span className="scale-badge--long"> (raised so the Moon clears Earth)</span>}
        </span>
      </div>
      <button
        type="button"
        className="scale-badge__dismiss"
        onClick={() => {
          setDismissedFor(key);
        }}
        title="Dismiss (comes back if you change the scale)"
      >
        <X size={14} aria-hidden />
        <span className="visually-hidden">Dismiss</span>
      </button>
    </div>
  );
}
