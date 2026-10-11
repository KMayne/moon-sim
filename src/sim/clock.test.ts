import { describe, expect, it } from 'vitest';
import { MAX_SIM_TIME, SimClock } from './clock';

function fakeWall() {
  let now = 0;
  return {
    wallNow: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

const START = new Date(Date.UTC(2026, 0, 1));

describe('SimClock', () => {
  it('derives sim time from elapsed wall time × speed', () => {
    const wall = fakeWall();
    const clock = new SimClock({ start: START, speed: 3600, wallNow: wall.wallNow });
    wall.advance(1000);
    expect(clock.nowMs()).toBe(START.getTime() + 3_600_000);
  });

  it('does not depend on how often it is sampled', () => {
    const a = fakeWall();
    const b = fakeWall();
    const sparse = new SimClock({ start: START, speed: 86_400, wallNow: a.wallNow });
    const dense = new SimClock({ start: START, speed: 86_400, wallNow: b.wallNow });
    a.advance(10_000);
    for (let i = 0; i < 600; i++) {
      b.advance(10_000 / 600);
      dense.nowMs();
    }
    expect(dense.nowMs()).toBeCloseTo(sparse.nowMs(), -1);
  });

  it('changes speed without jumping', () => {
    const wall = fakeWall();
    const clock = new SimClock({ start: START, speed: 60, wallNow: wall.wallNow });
    wall.advance(1000);
    const before = clock.nowMs();
    clock.setSpeed(-3600);
    expect(clock.nowMs()).toBe(before);
    wall.advance(1000);
    expect(clock.nowMs()).toBe(before - 3_600_000);
  });

  it('stands still while frozen and resumes without jumping', () => {
    const wall = fakeWall();
    const clock = new SimClock({ start: START, speed: 3600, wallNow: wall.wallNow });
    clock.setFrozen(true);
    wall.advance(60_000);
    expect(clock.nowMs()).toBe(START.getTime());
    clock.setFrozen(false);
    wall.advance(1000);
    expect(clock.nowMs()).toBe(START.getTime() + 3_600_000);
  });

  it('stops at the end of the supported range', () => {
    const wall = fakeWall();
    let clamped = 0;
    const clock = new SimClock({
      start: new Date(MAX_SIM_TIME - 1000),
      wallNow: wall.wallNow,
      onClamp: () => clamped++,
    });
    clock.setSpeed(1e9);
    wall.advance(1000);
    expect(clock.nowMs()).toBe(MAX_SIM_TIME);
    expect(clock.speed).toBe(0);
    expect(clamped).toBe(1);
  });
});
