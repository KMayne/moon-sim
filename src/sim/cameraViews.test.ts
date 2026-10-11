import { describe, expect, it } from 'vitest';
import {
  defaultSkyLook,
  formatOrbitCamera,
  formatSkyLook,
  normalizeSkyLook,
  parseOrbitCamera,
  parseSkyLook,
  sameView,
} from './cameraViews';

describe('sky look', () => {
  it('faces the equator by default', () => {
    expect(defaultSkyLook(51).azimuthDeg).toBe(180);
    expect(defaultSkyLook(-33).azimuthDeg).toBe(0);
  });

  it('wraps azimuth and rounds to a tenth of a degree', () => {
    expect(normalizeSkyLook({ azimuthDeg: -90.04, altitudeDeg: 12.345, fovDeg: 70 })).toEqual({
      azimuthDeg: 270,
      altitudeDeg: 12.3,
      fovDeg: 70,
    });
    expect(normalizeSkyLook({ azimuthDeg: 359.99, altitudeDeg: 0, fovDeg: 70 }).azimuthDeg).toBe(0);
  });

  it('round-trips through the link format', () => {
    const look = { azimuthDeg: 123.4, altitudeDeg: -5.5, fovDeg: 25 };
    expect(formatSkyLook(look)).toBe('123.4,-5.5,25');
    expect(parseSkyLook(formatSkyLook(look))).toEqual(look);
  });

  it('rejects malformed or out-of-range looks', () => {
    for (const text of [null, '', '1,2', '1,2,3,4', 'a,b,c', '0,95,70', '0,20,5', '0,20,120']) {
      expect(parseSkyLook(text)).toBeUndefined();
    }
  });
});

describe('orbit camera', () => {
  it('round-trips through the link format', () => {
    const camera = { x: -150.123, y: 45, z: 0.002 };
    expect(formatOrbitCamera(camera)).toBe('-150.123,45,0.002');
    expect(parseOrbitCamera(formatOrbitCamera(camera))).toEqual(camera);
  });

  it('rejects a zero, too distant or malformed offset', () => {
    for (const text of ['0,0,0', '1000,1000,0', '1,2', 'x,1,2']) {
      expect(parseOrbitCamera(text)).toBeUndefined();
    }
  });
});

describe('sameView', () => {
  it('compares field by field, treating null as its own value', () => {
    expect(sameView({ x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 3 })).toBe(true);
    expect(sameView({ x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 4 })).toBe(false);
    expect(sameView(null, { x: 1, y: 2, z: 3 })).toBe(false);
    expect(sameView(null, null)).toBe(true);
  });
});
