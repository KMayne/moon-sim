import { Button, Text } from '@mantine/core';
import { LocateFixed } from 'lucide-react';
import { useState } from 'react';
import { customLocation } from '../../state/locations';
import { useSimStore } from '../../state/store';
import {
  LOCATE_ERROR_TEXT,
  locate,
  LocateFailure,
  nearbyPlaceName,
  type LocateError,
} from '../myLocation';

/** Moves the observer to the user's (approximate) position, with the browser's permission. */
export function UseMyLocation() {
  const setLocation = useSimStore((s) => s.setLocation);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LocateError | null>(null);

  const onClick = async () => {
    setBusy(true);
    setError(null);
    try {
      const { latitude, longitude } = await locate();
      setLocation(customLocation(latitude, longitude, 'My location'));
      const name = await nearbyPlaceName(latitude, longitude);
      if (name) setLocation(customLocation(latitude, longitude, `Near ${name}`));
    } catch (reason) {
      setError(reason instanceof LocateFailure ? reason.reason : 'unavailable');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Button
        variant="light"
        size="xs"
        fullWidth
        leftSection={<LocateFixed size={14} aria-hidden />}
        loading={busy}
        onClick={() => {
          void onClick();
        }}
      >
        Use my location
      </Button>
      {error ? (
        <Text size="xs" c="red.4" mt={4} role="alert">
          {LOCATE_ERROR_TEXT[error]}
        </Text>
      ) : (
        <Text size="xs" c="dimmed" mt={4}>
          Rounded to ~10 km; it appears in the page link.
        </Text>
      )}
    </div>
  );
}
