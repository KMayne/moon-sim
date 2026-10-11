import { LOCATION_PRESETS, type LocationPresetId } from '../state/locations';

export type LocationChoice = LocationPresetId | 'custom';

export interface ObserverPanelValues {
  location: LocationChoice;
  latitude: number;
  longitude: number;
}

const SAME_COORD = 1e-6;

/**
 * Keeps the Observer panel self-consistent. Latitude/longitude are always shown:
 * - picking a preset fills them with its coordinates;
 * - editing them while a preset is selected switches the choice to Custom.
 * Returns the fields to update, or null if the panel is already consistent.
 */
export function reconcileObserverPanel(
  prev: ObserverPanelValues,
  next: ObserverPanelValues,
): Partial<ObserverPanelValues> | null {
  if (next.location === 'custom') return null;
  const preset = LOCATION_PRESETS[next.location];
  const matchesPreset =
    Math.abs(next.latitude - preset.latitude) < SAME_COORD &&
    Math.abs(next.longitude - preset.longitude) < SAME_COORD;
  if (matchesPreset) return null;
  if (next.location !== prev.location) {
    return { latitude: preset.latitude, longitude: preset.longitude };
  }
  return { location: 'custom' };
}
