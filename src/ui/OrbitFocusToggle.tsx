import { SegmentedControl } from '@mantine/core';
import { useSimStore } from '../state/store';

/** Earth- or Moon-centred orbit view (e.g. Moon to watch Earth's shadow during an eclipse). */
export function OrbitFocusToggle() {
  const focus = useSimStore((s) => s.orbitFocus);
  const setFocus = useSimStore((s) => s.setOrbitFocus);
  return (
    <SegmentedControl
      className="orbit-focus"
      size="xs"
      aria-label="Centre the orbit view on"
      value={focus}
      onChange={(value) => {
        setFocus(value);
      }}
      data={[
        { value: 'earth', label: 'Earth' },
        { value: 'moon', label: 'Moon' },
      ]}
    />
  );
}
