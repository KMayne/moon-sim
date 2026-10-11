import { describe, expect, it } from 'vitest';
import { clampDiscSize, DISC_CHROME_PX, DISC_SIZE, dragDiscSize, rowDiscSize } from './discSize';

describe('clampDiscSize', () => {
  it('keeps a fitting size', () => {
    expect(clampDiscSize(280, 550, 800)).toBe(280);
  });

  it('never goes below the minimum when the minimum fits', () => {
    expect(clampDiscSize(10, 550, 800)).toBe(DISC_SIZE.min);
  });

  it('shrinks below the minimum to fit a short view, but not below the floor', () => {
    expect(clampDiscSize(400, 390, 156)).toBe(156 - DISC_CHROME_PX);
    expect(clampDiscSize(10, 390, 156)).toBe(156 - DISC_CHROME_PX);
    expect(clampDiscSize(400, 200, 100)).toBe(DISC_SIZE.floor);
  });

  it('fits the view height (with header and caption) and 60% of its width', () => {
    expect(clampDiscSize(2000, 550, 800)).toBe(330);
    expect(clampDiscSize(2000, 2000, 500)).toBe(500 - DISC_CHROME_PX);
  });
});

describe('dragDiscSize', () => {
  it('grows when the left edge is dragged left and shrinks when dragged right', () => {
    expect(dragDiscSize(280, -40)).toBe(320);
    expect(dragDiscSize(280, 30)).toBe(250);
  });
});

describe('rowDiscSize', () => {
  it('takes a quarter of the views, between the floor and the minimum', () => {
    expect(rowDiscSize(480)).toBe(120);
    expect(rowDiscSize(2000)).toBe(DISC_SIZE.min);
    expect(rowDiscSize(100)).toBe(DISC_SIZE.floor);
  });
});
