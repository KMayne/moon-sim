import {
  MoonAgeCache,
  moonPhaseInfo,
  RiseSetCache,
  type MoonPhaseInfo,
  type RiseSet,
} from '../astro/events';
import { computeSystemState } from '../astro/ephemeris';
import { toSkyScene } from '../sim/skyScene';
import type { ObserverLocation } from '../state/locations';
import { zoneFor } from './format';

export interface HudCaches {
  readonly riseSet: RiseSetCache;
  readonly age: MoonAgeCache;
}

export const createHudCaches = (): HudCaches => ({
  riseSet: new RiseSetCache(),
  age: new MoonAgeCache(),
});

export interface HudSnapshot {
  readonly simMs: number;
  readonly location: ObserverLocation;
  readonly zone: string;
  readonly phase: MoonPhaseInfo;
  readonly ageDays: number;
  readonly riseSet: RiseSet;
  /** Topocentric, unrefracted altitude of the Moon's centre, degrees. */
  readonly moonAltitudeDeg: number;
}

/** Everything the HUD shows for one instant. Bounded cost: expensive searches are cached. */
export function hudSnapshot(
  simMs: number,
  location: ObserverLocation,
  caches: HudCaches,
): HudSnapshot {
  return {
    simMs,
    location,
    zone: zoneFor(location),
    phase: moonPhaseInfo(new Date(simMs)),
    ageDays: caches.age.ageDays(simMs),
    riseSet: caches.riseSet.next(location, simMs),
    moonAltitudeDeg: toSkyScene(computeSystemState(new Date(simMs)), location, { moonSize: 1 }).moon
      .altitude,
  };
}
