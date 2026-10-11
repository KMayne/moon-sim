import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAYBACK,
  faster,
  playbackFromSpeed,
  playbackSpeed,
  slower,
  SPEED_STEPS,
  speedLabel,
  togglePlaying,
  toggleReverse,
} from './playback';

describe('playback', () => {
  it('starts playing forwards at 1 h/s', () => {
    expect(playbackSpeed(DEFAULT_PLAYBACK)).toBe(3600);
  });

  it('pausing keeps the speed step for when play resumes', () => {
    const paused = togglePlaying(DEFAULT_PLAYBACK);
    expect(playbackSpeed(paused)).toBe(0);
    expect(playbackSpeed(togglePlaying(paused))).toBe(3600);
  });

  it('steps faster and slower along the ladder, stopping at both ends', () => {
    let p = DEFAULT_PLAYBACK;
    for (let i = 0; i < 20; i++) p = faster(p);
    expect(playbackSpeed(p)).toBe(SPEED_STEPS[SPEED_STEPS.length - 1]?.speed);
    for (let i = 0; i < 20; i++) p = slower(p);
    expect(playbackSpeed(p)).toBe(1);
  });

  it('never reverses by slowing down; reverse is explicit', () => {
    let p = DEFAULT_PLAYBACK;
    for (let i = 0; i < 20; i++) p = slower(p);
    expect(playbackSpeed(p)).toBeGreaterThan(0);
    expect(playbackSpeed(toggleReverse(p))).toBe(-1);
    expect(speedLabel(toggleReverse(p))).toBe('Real time (reverse)');
  });

  it('round-trips signed speeds from links; 0 is paused; unknown speeds are rejected', () => {
    expect(playbackFromSpeed(-86_400)).toMatchObject({ playing: true, reverse: true });
    expect(playbackSpeed(playbackFromSpeed(-86_400) ?? DEFAULT_PLAYBACK)).toBe(-86_400);
    expect(playbackFromSpeed(0)).toMatchObject({ playing: false });
    expect(playbackFromSpeed(1234)).toBeNull();
  });
});
