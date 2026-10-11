import { describe, expect, it } from 'vitest';
import { customLocation } from './locations';

describe('customLocation', () => {
  it('clamps latitude and wraps longitude into [-180, 180)', () => {
    expect(customLocation(95, 190)).toMatchObject({ latitude: 90, longitude: -170 });
    expect(customLocation(-91, -181)).toMatchObject({ latitude: -90, longitude: 179 });
    expect(customLocation(10, 20)).toMatchObject({ latitude: 10, longitude: 20 });
  });
});
