import { button, Leva, useControls } from 'leva';
import { useEffect } from 'react';
import {
  customLocation,
  LOCATION_PRESETS,
  type LocationPresetId,
  type ObserverLocation,
} from '../state/locations';
import { useSimStore } from '../state/store';
import { SPEED_PRESETS } from './speeds';

/** Parses "YYYY-MM-DD" or "YYYY-MM-DD HH:mm" as UTC. */
function parseUtc(text: string): Date | null {
  const m = /^\s*(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?\s*$/.exec(text);
  if (!m) return null;
  const [, y, mo, d, h = '0', mi = '0'] = m;
  const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  return Number.isNaN(ms) ? null : new Date(ms);
}

type LocationChoice = LocationPresetId | 'custom';

const LOCATION_OPTIONS: Record<string, LocationChoice> = {
  ...Object.fromEntries(Object.values(LOCATION_PRESETS).map((p) => [p.label, p.id])),
  Custom: 'custom',
};

function toLocation(choice: LocationChoice, latitude: number, longitude: number): ObserverLocation {
  return choice === 'custom' ? customLocation(latitude, longitude) : LOCATION_PRESETS[choice];
}

/**
 * The only module that knows about Leva. It mirrors panel values into the zustand store, which
 * stays the single source of truth; swapping the panel library means rewriting this file only.
 */
export function Controls() {
  const setSpeed = useSimStore((s) => s.setSpeed);
  const setTime = useSimStore((s) => s.setTime);
  const setLocation = useSimStore((s) => s.setLocation);
  const storeSpeed = useSimStore((s) => s.speed);

  const [time, setTimePanel] = useControls('Time', () => {
    // Initial values come from the store, which may have been seeded from the URL.
    const speed = useSimStore.getState().speed;
    return {
      speed: { label: 'speed', value: Math.abs(speed), options: SPEED_PRESETS },
      reverse: { label: 'reverse', value: speed < 0 },
      goTo: { label: 'go to (UTC)', value: '', placeholder: 'YYYY-MM-DD HH:mm' },
      now: button(() => {
        setTime(new Date());
      }),
    };
  });

  const [observer] = useControls('Observer', () => {
    const location = useSimStore.getState().location;
    const isCustom = (get: (path: string) => unknown) => get('Observer.location') === 'custom';
    return {
      location: { label: 'location', value: location.id, options: LOCATION_OPTIONS },
      latitude: {
        label: 'latitude °N',
        value: location.latitude,
        min: -90,
        max: 90,
        step: 0.01,
        render: isCustom,
      },
      longitude: {
        label: 'longitude °E',
        value: location.longitude,
        min: -180,
        max: 180,
        step: 0.01,
        render: isCustom,
      },
    };
  });

  useEffect(() => {
    setSpeed(time.speed * (time.reverse ? -1 : 1));
  }, [time.speed, time.reverse, setSpeed]);

  useEffect(() => {
    const date = parseUtc(time.goTo);
    if (date) setTime(date);
  }, [time.goTo, setTime]);

  useEffect(() => {
    setLocation(toLocation(observer.location, observer.latitude, observer.longitude));
  }, [observer.location, observer.latitude, observer.longitude, setLocation]);

  // The clock can stop itself at the edge of its range; reflect that in the panel.
  useEffect(() => {
    if (storeSpeed === 0) setTimePanel({ speed: 0 });
  }, [storeSpeed, setTimePanel]);

  return (
    <Leva
      fill
      flat
      titleBar={false}
      hideCopyButton
      theme={{
        colors: { elevation1: '#0b0d14', elevation2: '#11141d', elevation3: '#1b2030' },
        sizes: { rootWidth: '100%', controlWidth: '60%' },
        fontSizes: { root: '12px' },
      }}
    />
  );
}
