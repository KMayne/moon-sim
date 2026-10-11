import { create } from 'zustand';
import { SimClock } from '../sim/clock';
import { TRUE_SCALE, type VisualScale } from '../sim/visualScale';
import { DEFAULT_LOCATION, type ObserverLocation } from './locations';

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

export { TRUE_SCALE, type VisualScale };

export const useSimStore = create<SimStore>()((set) => {
  const clock = new SimClock({
    start: new Date(),
    speed: DEFAULT_SPEED,
    // The clock stops itself at the edge of the supported range; keep the UI in step.
    onClamp: () => {
      set({ speed: 0 });
    },
  });
  return {
    clock,
    speed: DEFAULT_SPEED,
    setSpeed: (speed) => {
      clock.setSpeed(speed);
      set({ speed });
    },
    setTime: (time) => {
      clock.setTime(time);
    },
    location: DEFAULT_LOCATION,
    setLocation: (location) => {
      set({ location });
    },
    visualScale: TRUE_SCALE,
    setVisualScale: (scale) => {
      set((s) => ({ visualScale: { ...s.visualScale, ...scale } }));
    },
  };
});
