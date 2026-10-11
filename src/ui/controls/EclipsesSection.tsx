import { EclipseList } from '../EclipseList';
import type { HudSnapshot } from '../hudModel';
import { Section } from './Section';

/** Next lunar and solar eclipses for this observer, each with a Watch jump. */
export function EclipsesSection({ snap }: { snap: HudSnapshot }) {
  return (
    <Section id="eclipses" title="Eclipses">
      <EclipseList eclipses={snap.eclipses} zone={snap.zone} />
    </Section>
  );
}
