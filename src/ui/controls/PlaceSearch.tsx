import { Autocomplete, Loader, Text } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { customLocation } from '../../state/locations';
import { useSimStore } from '../../state/store';
import { MIN_QUERY_LENGTH, PHOTON_ATTRIBUTION, searchPlaces, type Place } from '../photon';

const DEBOUNCE_MS = 300;

/** The latest finished search, tagged with its query so stale results are never shown. */
type SearchResult = { query: string; ok: true; places: Place[] } | { query: string; ok: false };

/** Search-as-you-type place lookup (Photon / OpenStreetMap). Picking a result moves the observer. */
export function PlaceSearch() {
  const setLocation = useSimStore((s) => s.setLocation);
  const [query, setQuery] = useState('');
  const [debounced] = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const [result, setResult] = useState<SearchResult | null>(null);
  const searching = debounced.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!searching) return;
    // Cancel the previous request so a slow response can't overwrite a newer one.
    const controller = new AbortController();
    searchPlaces(debounced, controller.signal).then(
      (places) => {
        setResult({ query: debounced, ok: true, places });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn(error);
        setResult({ query: debounced, ok: false });
      },
    );
    return () => {
      controller.abort();
    };
  }, [debounced, searching]);

  const current = searching && result?.query === debounced ? result : null;
  const loading = searching && current === null;
  const places = current?.ok ? current.places : [];
  const failed = current?.ok === false;

  return (
    <div>
      <Autocomplete
        label="Search for a place"
        placeholder="e.g. Reykjavík, Kitt Peak"
        leftSection={<Search size={14} aria-hidden />}
        rightSection={loading ? <Loader size={14} /> : null}
        value={query}
        onChange={setQuery}
        data={places.map((p) => p.label)}
        filter={({ options }) => options}
        error={failed ? 'Search is unavailable right now' : undefined}
        onOptionSubmit={(label) => {
          const place = places.find((p) => p.label === label);
          if (!place) return;
          setLocation(customLocation(place.latitude, place.longitude, place.label));
          setQuery('');
        }}
      />
      <Text size="xs" c="dimmed" mt={4}>
        {PHOTON_ATTRIBUTION}
      </Text>
    </div>
  );
}
