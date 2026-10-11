import { Divider } from '@mantine/core';
import { FlairSection } from './controls/FlairSection';
import { ObserverSection } from './controls/ObserverSection';
import { TimeSection } from './controls/TimeSection';
import { VisualAidsSection } from './controls/VisualAidsSection';

/**
 * The sidebar controls. Every control reads and writes the zustand store directly, which stays the
 * single source of truth (play/pause and speed live in the transport bar).
 */
export function Controls() {
  return (
    <>
      <TimeSection />
      <Divider />
      <ObserverSection />
      <Divider />
      <VisualAidsSection />
      <Divider />
      <FlairSection />
    </>
  );
}
