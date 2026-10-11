/** An observer on Earth's surface (WGS 84, degrees; east and north positive). */
export interface ObserverLocation {
  readonly id: LocationPresetId | 'custom';
  readonly label: string;
  readonly latitude: number;
  readonly longitude: number;
}

export type LocationPresetId = 'tromso' | 'mauna-kea' | 'paranal';

export const LOCATION_PRESETS: Record<LocationPresetId, ObserverLocation> = {
  tromso: { id: 'tromso', label: 'Tromsø', latitude: 69.65, longitude: 18.96 },
  'mauna-kea': { id: 'mauna-kea', label: 'Mauna Kea', latitude: 19.82, longitude: -155.47 },
  paranal: { id: 'paranal', label: 'Paranal', latitude: -24.63, longitude: -70.4 },
};

export const DEFAULT_LOCATION = LOCATION_PRESETS.tromso;

export function customLocation(latitude: number, longitude: number): ObserverLocation {
  return {
    id: 'custom',
    label: 'Custom',
    latitude: Math.min(90, Math.max(-90, latitude)),
    longitude: ((((longitude + 180) % 360) + 360) % 360) - 180,
  };
}
