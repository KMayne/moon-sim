import { isTrueScale, resolveVisualScale } from '../sim/visualScale';
import { useSimStore } from '../state/store';

const fmt = (x: number): string => `${Number(x.toFixed(2))}×`;

/** Always visible while any visual aid is on, so a scaled view is never mistaken for true scale. */
export function ScaleBadge() {
  const requested = useSimStore((s) => s.visualScale);
  const applied = resolveVisualScale(requested);
  if (isTrueScale(applied)) return null;

  const raised = applied.moonDistance > requested.moonDistance;
  return (
    <div className="scale-badge" role="status">
      <strong>Visual aid active: not to scale</strong>
      <span>
        Body size {fmt(applied.bodySize)}, distance {fmt(applied.moonDistance)}
        {raised && ' (raised so the Moon clears Earth)'}
      </span>
    </div>
  );
}
