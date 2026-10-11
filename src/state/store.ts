import { create } from 'zustand';
import { SimClock } from '../sim/clock';
import { SPEED_PRESETS } from '../ui/speeds';
import { DEFAULT_LOCATION, type ObserverLocation } from './locations';
import { parseUrlState } from './urlState';

/** Sim seconds per wall second. */
export const DEFAULT_SPEED = 3600;

interface SimStore {
  /** The single sim clock. Read imperatively (`clock.nowMs()`) in the frame loop, never via React. */
  readonly clock: SimClock;
  /** Mirrors `clock.speed` for React consumers. */
  speed: number;
  setSpeed: (speed: number) => void;
  setTime: (time: Date) => void;
  /** Observer for the sky view, HUD rise/set times and local time. */
  location: ObserverLocation;
  setLocation: (location: ObserverLocation) => void;
  /** Visual aids only (render-time); 1 = true scale. Never fed back into astronomy. */
  visualScale: VisualScale;
  setVisualScale: (scale: Partial<VisualScale>) => void;
}

export interface VisualScale {
  /** Multiplies the Moon's rendered radius only. */
  moonSize: number;
  /** Multiplies the Moon's rendered distance from Earth only. */
  moonDistance: number;
}

export const TRUE_SCALE: VisualScale = { moonSize: 1, moonDistance: 1 };

/** Anything a shared link pins down (location, time, speed) overrides the defaults. */
const fromUrl =
  typeof window === 'undefined'
    ? {}
    : parseUrlState(window.location.search, Object.values(SPEED_PRESETS));
const initialSpeed = fromUrl.speed ?? DEFAULT_SPEED;

export const useSimStore = create<SimStore>()((set) => {
  const clock = new SimClock({
    start: fromUrl.timeMs === undefined ? new Date() : new Date(fromUrl.timeMs),
    speed: initialSpeed,
    // The clock stops itself at the edge of the supported range; keep the UI in step.
    onClamp: () => {
      set({ speed: 0 });
    },
  });
  return {
    clock,
    speed: initialSpeed,
    setSpeed: (speed) => {
      clock.setSpeed(speed);
      set({ speed });
    },
    setTime: (time) => {
      clock.setTime(time);
    },
    location: fromUrl.location ?? DEFAULT_LOCATION,
    setLocation: (location) => {
      set({ location });
    },
    visualScale: TRUE_SCALE,
    setVisualScale: (scale) => {
      set((s) => ({ visualScale: { ...s.visualScale, ...scale } }));
    },
  };
});
