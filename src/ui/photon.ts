/**
 * Place search via Photon (https://photon.komoot.io), Komoot's public geocoder over OpenStreetMap
 * data. Free, no key, built for search-as-you-type. Results are © OpenStreetMap contributors and
 * must be attributed where the search is shown. Queries go to Komoot only while the user searches.
 */

const ENDPOINT = 'https://photon.komoot.io/api/';
export const PHOTON_ATTRIBUTION = 'Search by Photon · © OpenStreetMap contributors';
export const MIN_QUERY_LENGTH = 3;
const RESULT_LIMIT = 6;

export interface Place {
  /** Short display name, e.g. "Mauna Kea, Hawaii, United States". */
  readonly label: string;
  readonly latitude: number;
  readonly longitude: number;
}

interface PhotonFeature {
  geometry?: { coordinates?: unknown };
  properties?: Record<string, unknown>;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

/** Photon GeoJSON → places with distinct labels. Malformed features are skipped. */
export function parsePhotonResponse(json: unknown): Place[] {
  const features = (json as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) return [];
  const places: Place[] = [];
  const seen = new Set<string>();
  for (const f of features as PhotonFeature[]) {
    const coords = f.geometry?.coordinates;
    if (!Array.isArray(coords)) continue;
    const [lon, lat] = coords as unknown[];
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    const p = f.properties ?? {};
    const parts = [str(p.name), str(p.city), str(p.state), str(p.country)].filter(
      (part, i, all): part is string => part !== undefined && all.indexOf(part) === i,
    );
    if (parts.length === 0) continue;
    const label = parts.join(', ');
    if (seen.has(label)) continue;
    seen.add(label);
    places.push({ label, latitude: lat, longitude: lon });
  }
  return places;
}

export async function searchPlaces(query: string, signal: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) return [];
  const url = `${ENDPOINT}?${new URLSearchParams({ q, limit: String(RESULT_LIMIT), lang: 'en' }).toString()}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Photon search failed: HTTP ${response.status}`);
  return parsePhotonResponse(await response.json());
}
