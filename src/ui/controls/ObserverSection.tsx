import { Group, NumberInput, Select } from '@mantine/core';
import {
  customLocation,
  LOCATION_PRESETS,
  type LocationPresetId,
  type ObserverLocation,
} from '../../state/locations';
import { useSimStore } from '../../state/store';
import { PlaceSearch } from './PlaceSearch';
import { Section } from './Section';
import { UseMyLocation } from './UseMyLocation';

const isPresetId = (id: string): id is LocationPresetId => id in LOCATION_PRESETS;

/** The current location as a select option: presets by id; anything else shows its own name. */
function options(location: ObserverLocation) {
  const presets = Object.values(LOCATION_PRESETS).map((p) => ({ value: p.id, label: p.label }));
  return location.id === 'custom'
    ? [...presets, { value: 'custom', label: location.label }]
    : presets;
}

export function ObserverSection() {
  const location = useSimStore((s) => s.location);
  const setLocation = useSimStore((s) => s.setLocation);

  return (
    <Section id="observer" title="Observer">
      <UseMyLocation />
      <PlaceSearch />
      <Select
        label="Location"
        data={options(location)}
        value={location.id}
        allowDeselect={false}
        onChange={(id) => {
          if (id && isPresetId(id)) setLocation(LOCATION_PRESETS[id]);
        }}
      />
      {/* Editing coordinates makes a custom location; presets fill these in. */}
      <Group grow gap="xs">
        <NumberInput
          label="Latitude °N"
          value={location.latitude}
          min={-90}
          max={90}
          step={0.01}
          decimalScale={4}
          clampBehavior="blur"
          onChange={(v) => {
            if (typeof v === 'number') setLocation(customLocation(v, location.longitude));
          }}
        />
        <NumberInput
          label="Longitude °E"
          value={location.longitude}
          min={-180}
          max={180}
          step={0.01}
          decimalScale={4}
          clampBehavior="blur"
          onChange={(v) => {
            if (typeof v === 'number') setLocation(customLocation(location.latitude, v));
          }}
        />
      </Group>
    </Section>
  );
}
