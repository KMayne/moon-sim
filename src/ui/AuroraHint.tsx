import { AURORA_RULE_TEXT } from '../sim/auroraVisibility';
import { useSimStore } from '../state/store';

const REASON = {
  'too-far-south': 'Not visible from here: too far south.',
  'not-dark': 'Not visible yet: not dark enough.',
} as const;

/** Explains an enabled-but-invisible aurora, so the toggle never looks broken. */
export function AuroraHint() {
  const enabled = useSimStore((s) => s.auroraEnabled);
  const status = useSimStore((s) => s.auroraStatus);
  if (!enabled || status === 'visible') return null;
  return (
    <p className="aurora-hint" role="status">
      {REASON[status]} {AURORA_RULE_TEXT}
    </p>
  );
}
