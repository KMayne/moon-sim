import { describe, expect, it } from 'vitest';
import { clampDiscSize, DISC_CHROME_PX, DISC_SIZE, dragDiscSize } from './discSize';

describe('clampDiscSize', () => {
  it('keeps a fitting size', () => {
    expect(clampDiscSize(280, 550, 800)).toBe(280);
  });

  it('never goes below the minimum, even in a tiny view', () => {
    expect(clampDiscSize(10, 550, 800)).toBe(DISC_SIZE.min);
    expect(clampDiscSize(400, 200, 150)).toBe(DISC_SIZE.min);
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
