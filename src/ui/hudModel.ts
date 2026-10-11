import {
  MoonAgeCache,
  moonPhaseInfo,
  RiseSetCache,
  type MoonPhaseInfo,
  type RiseSet,
} from '../astro/events';
import {
  EclipseCache,
  eclipseInProgress,
  type GlobalSolarEclipse,
  type InProgress,
  type LocalSolarEclipse,
  type LunarEclipse,
} from '../astro/eclipses';
import { computeSystemState } from '../astro/ephemeris';
import { toSkyScene } from '../sim/skyScene';
import type { ObserverLocation } from '../state/locations';
import { zoneFor } from './format';

export interface HudCaches {
  readonly riseSet: RiseSetCache;
  readonly age: MoonAgeCache;
  readonly eclipses: EclipseCache;
}

export const createHudCaches = (): HudCaches => ({
  riseSet: new RiseSetCache(),
  age: new MoonAgeCache(),
  eclipses: new EclipseCache(),
});

export interface HudEclipses {
  /** Next or current lunar eclipse (seen from anywhere the Moon is up). */
  readonly lunar: LunarEclipse;
  /** Next or current solar eclipse with the Sun up for this observer; null if none for decades. */
  readonly localSolar: LocalSolarEclipse | null;
  /** Next or current solar eclipse anywhere on Earth. */
  readonly globalSolar: GlobalSolarEclipse;
  /** An eclipse the observer could be watching right now. */
  readonly inProgress: InProgress | null;
}

export interface HudSnapshot {
  readonly simMs: number;
  readonly location: ObserverLocation;
  readonly zone: string;
  readonly phase: MoonPhaseInfo;
  readonly ageDays: number;
  readonly riseSet: RiseSet;
  /** Topocentric, unrefracted altitude of the Moon's centre, degrees. */
  readonly moonAltitudeDeg: number;
  readonly eclipses: HudEclipses;
}

/** Everything the HUD shows for one instant. Bounded cost: expensive searches are cached. */
export function hudSnapshot(
  simMs: number,
  location: ObserverLocation,
  caches: HudCaches,
): HudSnapshot {
  const lunar = caches.eclipses.lunar(location, simMs);
  const localSolar = caches.eclipses.localSolar(location, simMs);
  return {
    simMs,
    location,
    zone: zoneFor(location),
    phase: moonPhaseInfo(new Date(simMs)),
    ageDays: caches.age.ageDays(simMs),
    riseSet: caches.riseSet.next(location, simMs),
    moonAltitudeDeg: toSkyScene(computeSystemState(new Date(simMs)), location, { bodySize: 1 }).moon
      .altitude,
    eclipses: {
      lunar,
      localSolar,
      globalSolar: caches.eclipses.globalSolar(simMs),
      inProgress: eclipseInProgress(lunar, localSolar, location, simMs),
    },
  };
}
