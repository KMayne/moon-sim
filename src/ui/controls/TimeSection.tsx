import { Button, Group } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_SIM_TIME, MIN_SIM_TIME } from '../../sim/clock';
import { useSimStore } from '../../state/store';
import { zoneFor } from '../format';
import { fromZonedString, toZonedString } from '../zonedTime';
import { Section } from './Section';

/** How often the closed picker refreshes to follow the running clock. */
const REFRESH_MS = 1000;

/**
 * Jump to a date and time, picked in the observer's local time zone (where "22:00 in Tromsø"
 * means what you'd expect). Play/pause and speed live in the transport bar.
 */
export function TimeSection() {
  const clock = useSimStore((s) => s.clock);
  const setTime = useSimStore((s) => s.setTime);
  const location = useSimStore((s) => s.location);
  const zone = useMemo(() => zoneFor(location), [location]);

  const [value, setValue] = useState(() => toZonedString(clock.nowMs(), zone));
  const open = useRef(false);

  useEffect(() => {
    const refresh = () => {
      if (!open.current) setValue(toZonedString(clock.nowMs(), zone));
    };
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => {
      clearInterval(id);
    };
  }, [clock, zone]);

  return (
    <Section title="Time">
      <DateTimePicker
        label="Date & time"
        description={`Observer's local time (${zone})`}
        value={value}
        valueFormat="D MMM YYYY, HH:mm"
        minDate={toZonedString(MIN_SIM_TIME, zone)}
        maxDate={toZonedString(MAX_SIM_TIME, zone)}
        popoverProps={{
          onOpen: () => {
            open.current = true;
          },
          onClose: () => {
            open.current = false;
          },
        }}
        onChange={(next) => {
          if (!next) return;
          const ms = fromZonedString(next, zone);
          if (ms === null) return;
          setValue(next);
          setTime(new Date(ms));
        }}
      />
      <Group justify="flex-end">
        <Button
          variant="light"
          size="xs"
          onClick={() => {
            setTime(new Date());
          }}
        >
          Now
        </Button>
      </Group>
    </Section>
  );
}
