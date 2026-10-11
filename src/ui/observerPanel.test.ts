import { describe, expect, it } from 'vitest';
import { LOCATION_PRESETS } from '../state/locations';
import { reconcileObserverPanel, type ObserverPanelValues } from './observerPanel';

const tromso: ObserverPanelValues = { location: 'tromso', latitude: 69.65, longitude: 18.96 };

describe('reconcileObserverPanel', () => {
  it('fills coordinates when a preset is picked', () => {
    const next = { ...tromso, location: 'paranal' as const };
    expect(reconcileObserverPanel(tromso, next)).toEqual({
      latitude: LOCATION_PRESETS.paranal.latitude,
      longitude: LOCATION_PRESETS.paranal.longitude,
    });
  });

  it('switches to Custom when coordinates are edited under a preset', () => {
    expect(reconcileObserverPanel(tromso, { ...tromso, latitude: 51.48 })).toEqual({
      location: 'custom',
    });
  });

  it('leaves a consistent panel alone', () => {
    expect(reconcileObserverPanel(tromso, tromso)).toBeNull();
    const custom = { location: 'custom' as const, latitude: 51.48, longitude: -0.01 };
    expect(reconcileObserverPanel(tromso, custom)).toBeNull();
  });
});
