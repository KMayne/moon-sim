import { Switch } from '@mantine/core';
import { useSimStore } from '../../state/store';
import { AuroraHint } from '../AuroraHint';
import { Section } from './Section';

export function FlairSection() {
  const auroraEnabled = useSimStore((s) => s.auroraEnabled);
  const setAuroraEnabled = useSimStore((s) => s.setAuroraEnabled);

  return (
    <Section id="flair" title="Flair — not simulated">
      <Switch
        label="Aurora (cosmetic)"
        checked={auroraEnabled}
        onChange={(e) => {
          setAuroraEnabled(e.currentTarget.checked);
        }}
      />
      <AuroraHint />
    </Section>
  );
}
