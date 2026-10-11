import { describe, expect, it } from 'vitest';
import { mesopicColor, scotopicLuminance, scotopicWeight, SCOTOPIC_TINT } from './mesopic';

const luminance = ([r, g, b]: readonly number[]) =>
  0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);

/** max−min over max: 0 = grey. */
const saturation = (rgb: readonly number[]) => {
  const max = Math.max(...rgb);
  return max === 0 ? 0 : (max - Math.min(...rgb)) / max;
};

describe('scotopicWeight', () => {
  it('is photopic in daylight and scotopic under moonlight', () => {
    expect(scotopicWeight(5000)).toBe(0);
    expect(scotopicWeight(4)).toBeCloseTo(0, 2);
    expect(scotopicWeight(0.01)).toBe(1);
    expect(scotopicWeight(0.001)).toBe(1);
  });

  it('falls monotonically through the mesopic range', () => {
    const ls = [0.01, 0.03, 0.1, 0.3, 1, 3];
    const ws = ls.map(scotopicWeight);
    for (let i = 1; i < ws.length; i++) expect(ws[i]).toBeLessThan(ws[i - 1] ?? Infinity);
  });
});

describe('scotopicLuminance', () => {
  it('keeps D65 white unchanged', () => {
    expect(scotopicLuminance([1, 1, 1])).toBeCloseTo(1, 2);
  });

  it('darkens reds and brightens blues relative to their photopic luminance (Purkinje shift)', () => {
    const red: [number, number, number] = [1, 0.1, 0.05];
    const blue: [number, number, number] = [0.05, 0.2, 1];
    expect(scotopicLuminance(red) / luminance(red)).toBeLessThan(0.8);
    expect(scotopicLuminance(blue) / luminance(blue)).toBeGreaterThan(1.2);
  });
});

describe('mesopicColor', () => {
  const brownSoil = [0.17, 0.15, 0.12] as const;

  it('leaves daylight colours untouched', () => {
    expect(mesopicColor(brownSoil, 10_000)).toEqual([...brownSoil]);
  });

  it('turns moonlit soil to a blue-tinted grey', () => {
    const moonlit = mesopicColor(brownSoil, 0.01 / luminance(brownSoil));
    expect(saturation(moonlit)).toBeLessThan(saturation(SCOTOPIC_TINT) + 1e-9);
    expect(moonlit[2]).toBeGreaterThan(moonlit[0]);
  });

  it('cools progressively as light falls (warm → grey → faintly blue)', () => {
    // Warmth = (red − blue) / luminance. Saturation isn't monotonic: the shift passes through grey.
    const warmth = (cd: number) => {
      const c = mesopicColor(brownSoil, cd / luminance(brownSoil));
      return (c[0] - c[2]) / luminance(c);
    };
    const levels = [10, 1, 0.3, 0.1, 0.03, 0.01];
    const ws = levels.map(warmth);
    for (let i = 1; i < ws.length; i++) expect(ws[i]).toBeLessThan(ws[i - 1] ?? Infinity);
    expect(ws[0]).toBeGreaterThan(0);
    expect(ws[ws.length - 1]).toBeLessThan(0);
  });
});
