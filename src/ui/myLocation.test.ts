import { describe, expect, it } from 'vitest';
import { reverseLabel, roundCoordinate } from './myLocation';

describe('roundCoordinate', () => {
  it('coarsens to 0.1° (~10 km) so shared links do not pinpoint the user', () => {
    expect(roundCoordinate(69.6496)).toBeCloseTo(69.6, 10);
    expect(roundCoordinate(18.9553)).toBeCloseTo(19.0, 10);
    expect(roundCoordinate(-0.1278)).toBeCloseTo(-0.1, 10);
  });
});

describe('reverseLabel', () => {
  it('prefers the town over the nearest feature', () => {
    const json = {
      features: [{ properties: { name: 'Bønntuva', city: 'Tromsø', country: 'Norway' } }],
    };
    expect(reverseLabel(json)).toBe('Tromsø, Norway');
  });

  it('falls back to county or name, and handles empty responses', () => {
    expect(reverseLabel({ features: [{ properties: { county: 'Hawaii', country: 'US' } }] })).toBe(
      'Hawaii, US',
    );
    expect(reverseLabel({ features: [] })).toBeNull();
    expect(reverseLabel(null)).toBeNull();
  });
});
