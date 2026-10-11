import { useCallback, useState } from 'react';

/**
 * A boolean remembered per viewer in localStorage. Storage can be unavailable or throw (private
 * windows, blocked site data), so every access is guarded and the fallback always works.
 */
export function usePersistentFlag(
  key: string,
  fallback: boolean,
): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? fallback : stored === 'true';
    } catch {
      return fallback;
    }
  });

  const update = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, String(next));
      } catch {
        // Not remembered this time; the in-memory state still applies.
      }
    },
    [key],
  );

  return [value, update];
}
