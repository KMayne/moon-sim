import { createContext, useContext } from 'react';
import type { DiscScene } from '../sim/discScene';
import type { OrbitScene } from '../sim/orbitScene';
import type { SkyScene } from '../sim/skyScene';

/**
 * Everything derived from sim time for the current frame. Computed once per frame by
 * <FrameDriver> and read by every view, so all views agree on the instant they show.
 */
export interface Frame {
  simMs: number;
  orbit: OrbitScene;
  sky: SkyScene;
  disc: DiscScene;
}

/** Mutable holder: written in the frame loop, read in the frame loop. Never React state. */
export interface FrameRef {
  current: Frame | null;
}

export const FrameContext = createContext<FrameRef | null>(null);

export function useFrameRef(): FrameRef {
  const ref = useContext(FrameContext);
  if (!ref) throw new Error('useFrameRef must be used inside <SimulationCanvas>');
  return ref;
}

/** Frame loop priorities. Lower runs first; drei <View>s render at priority ≥ 1. */
export const PRIORITY = {
  driver: -1,
  update: 0,
} as const;
