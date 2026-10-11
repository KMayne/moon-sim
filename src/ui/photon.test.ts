import { describe, expect, it } from 'vitest';
import { parsePhotonResponse } from './photon';

const feature = (lon: number, lat: number, properties: Record<string, unknown>) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties,
});

describe('parsePhotonResponse', () => {
  it('maps GeoJSON points (lon, lat) to labelled places', () => {
    const places = parsePhotonResponse({
      features: [
        feature(-155.468, 19.821, { name: 'Mauna Kea', state: 'Hawaii', country: 'United States' }),
      ],
    });
    expect(places).toEqual([
      { label: 'Mauna Kea, Hawaii, United States', latitude: 19.821, longitude: -155.468 },
    ]);
  });

  it('drops repeated name parts and duplicate labels', () => {
    const places = parsePhotonResponse({
      features: [
        feature(18.96, 69.65, { name: 'Tromsø', city: 'Tromsø', country: 'Norway' }),
        feature(18.97, 69.66, { name: 'Tromsø', city: 'Tromsø', country: 'Norway' }),
      ],
    });
    expect(places.map((p) => p.label)).toEqual(['Tromsø, Norway']);
  });

  it('ignores malformed features and responses', () => {
    expect(parsePhotonResponse(null)).toEqual([]);
    expect(parsePhotonResponse({ features: 'nope' })).toEqual([]);
    expect(
      parsePhotonResponse({
        features: [{ geometry: { coordinates: ['x', 1] }, properties: { name: 'Bad' } }, {}],
      }),
    ).toEqual([]);
  });
});
