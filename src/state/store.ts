import { create } from 'zustand';
import type { OrbitCamera, SkyLook } from '../sim/cameraViews';
import { SimClock } from '../sim/clock';
import type { AuroraStatus } from '../sim/auroraVisibility';
import {
  DEFAULT_PLAYBACK,
  faster,
  playbackSpeed,
  slower,
  togglePlaying,
  toggleReverse,
  type Playback,
} from '../sim/playback';
import { TRUE_SCALE, type VisualScale } from '../sim/visualScale';
import { DEFAULT_LOCATION, type ObserverLocation } from './locations';
import { parseUrlState, type OrbitFocus } from './urlState';

interface SimStore {
  /** The single sim clock. Read imperatively (`clock.nowMs()`) in the frame loop, never via React. */
  readonly clock: SimClock;
  /** Play/pause, direction and speed step; the clock's speed is always derived from this. */
  playback: Playback;
  /** Signed sim seconds per wall second actually applied to the clock (0 while paused). */
  speed: number;
  togglePlaying: () => void;
  faster: () => void;
  slower: () => void;
  toggleReverse: () => void;
  /** Set play/pause, direction and speed step at once (e.g. "watch this eclipse"). */
  setPlayback: (playback: Playback) => void;
  setTime: (time: Date) => void;
  /** Observer for the sky view, HUD rise/set times and local time. */
  location: ObserverLocation;
  setLocation: (location: ObserverLocation) => void;
  /** Visual aids only (render-time); 1 = true scale. Never fed back into astronomy. */
  visualScale: VisualScale;
  setVisualScale: (scale: Partial<VisualScale>) => void;
  /** Which body the orbit view's camera centres on and follows. */
  orbitFocus: OrbitFocus;
  setOrbitFocus: (focus: OrbitFocus) => void;
  /** Cosmetic aurora in the sky view. Flair only: not simulated, off by default. */
  auroraEnabled: boolean;
  setAuroraEnabled: (enabled: boolean) => void;
  /** Sky view look direction and zoom; null = the default, equator-facing view. */
  skyLook: SkyLook | null;
  setSkyLook: (look: SkyLook | null) => void;
  /** Orbit camera offset from its focus body; null = the fitted opening shot / Moon close-up. */
  orbitCamera: OrbitCamera | null;
  setOrbitCamera: (camera: OrbitCamera | null) => void;
  /** Written by the sky view only when it changes; drives the "why can't I see it" hint. */
  auroraStatus: AuroraStatus;
  setAuroraStatus: (status: AuroraStatus) => void;
}

export { TRUE_SCALE, type OrbitFocus, type VisualScale };

/** Anything a shared link pins down (location, time, speed, settings, cameras) overrides the defaults. */
const fromUrl = typeof window === 'undefined' ? {} : parseUrlState(window.location.search);
const initialPlayback = fromUrl.playback ?? DEFAULT_PLAYBACK;

export const useSimStore = create<SimStore>()((set, get) => {
  const clock = new SimClock({
    start: fromUrl.timeMs === undefined ? new Date() : new Date(fromUrl.timeMs),
    speed: playbackSpeed(initialPlayback),
    // The clock stops itself at the edge of the supported range: show that as paused.
    onClamp: () => {
      set((s) => ({ playback: { ...s.playback, playing: false }, speed: 0 }));
    },
  });
  const update = (change: (p: Playback) => Playback) => {
    const playback = change(get().playback);
    const speed = playbackSpeed(playback);
    clock.setSpeed(speed);
    set({ playback, speed });
  };
  return {
    clock,
    playback: initialPlayback,
    speed: playbackSpeed(initialPlayback),
    togglePlaying: () => {
      update(togglePlaying);
    },
    faster: () => {
      update(faster);
    },
    slower: () => {
      update(slower);
    },
    toggleReverse: () => {
      update(toggleReverse);
    },
    setPlayback: (playback) => {
      update(() => playback);
    },
    setTime: (time) => {
      clock.setTime(time);
    },
    location: fromUrl.location ?? DEFAULT_LOCATION,
    setLocation: (location) => {
      set({ location });
    },
    visualScale: fromUrl.visualScale ?? TRUE_SCALE,
    setVisualScale: (scale) => {
      set((s) => ({ visualScale: { ...s.visualScale, ...scale } }));
    },
    orbitFocus: fromUrl.orbitFocus ?? 'earth',
    setOrbitFocus: (orbitFocus) => {
      set({ orbitFocus });
    },
    auroraEnabled: fromUrl.auroraEnabled ?? false,
    setAuroraEnabled: (auroraEnabled) => {
      set({ auroraEnabled });
    },
    skyLook: fromUrl.skyLook ?? null,
    setSkyLook: (skyLook) => {
      set({ skyLook });
    },
    orbitCamera: fromUrl.orbitCamera ?? null,
    setOrbitCamera: (orbitCamera) => {
      set({ orbitCamera });
    },
    auroraStatus: 'not-dark',
    setAuroraStatus: (auroraStatus) => {
      set({ auroraStatus });
    },
  };
});
