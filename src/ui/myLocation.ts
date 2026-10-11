/**
 * "Use my location": the browser's Geolocation API, rounded before use. The position ends up in
 * the shareable URL, so it is coarsened to ~10 km — irrelevant astronomically (rise/set times move
 * by well under a minute) but enough not to pinpoint where someone is.
 */
export const LOCATION_ROUNDING_DEG = 0.1;

export const roundCoordinate = (deg: number): number =>
  Math.round(deg / LOCATION_ROUNDING_DEG) * LOCATION_ROUNDING_DEG;

export type LocateError = 'unsupported' | 'denied' | 'unavailable' | 'timeout';

export class LocateFailure extends Error {
  constructor(readonly reason: LocateError) {
    super(`Could not get location: ${reason}`);
  }
}

export const LOCATE_ERROR_TEXT: Record<LocateError, string> = {
  unsupported: "This browser can't share its location (it needs HTTPS).",
  denied: 'Location permission was denied.',
  unavailable: "Your location isn't available right now.",
  timeout: 'Finding your location took too long.',
};

export function locate(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject: (reason: LocateFailure) => void) => {
    if (!window.isSecureContext || !('geolocation' in navigator)) {
      reject(new LocateFailure('unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        resolve({
          latitude: roundCoordinate(coords.latitude),
          longitude: roundCoordinate(coords.longitude),
        });
      },
      (error) => {
        reject(
          new LocateFailure(
            error.code === error.PERMISSION_DENIED
              ? 'denied'
              : error.code === error.TIMEOUT
                ? 'timeout'
                : 'unavailable',
          ),
        );
      },
      // Coarse is all we need: faster, and kinder to battery.
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10 * 60_000 },
    );
  });
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

/**
 * Town-level label from a Photon reverse-geocoding response: the nearest feature may be a peak or a
 * shop, so prefer its city (then county, then its own name), plus the country.
 */
export function reverseLabel(json: unknown): string | null {
  const features = (json as { features?: { properties?: Record<string, unknown> }[] } | null)
    ?.features;
  const p = features?.[0]?.properties;
  if (!p) return null;
  const place = str(p.city) ?? str(p.county) ?? str(p.name);
  const country = str(p.country);
  if (!place) return country ?? null;
  return country && country !== place ? `${place}, ${country}` : place;
}

/** Nearby place name via Photon reverse geocoding (already-rounded coordinates only), or null. */
export async function nearbyPlaceName(latitude: number, longitude: number): Promise<string | null> {
  const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude), lang: 'en' });
  try {
    const response = await fetch(`https://photon.komoot.io/reverse?${params.toString()}`);
    if (!response.ok) return null;
    return reverseLabel(await response.json());
  } catch {
    return null;
  }
}
