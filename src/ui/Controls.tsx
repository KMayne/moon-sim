import { button, Leva, useControls } from 'leva';
import { useEffect, useRef } from 'react';
import { MOON_SIZE_RANGE, TRUE_SCALE } from '../sim/visualScale';
import {
  customLocation,
  LOCATION_PRESETS,
  type LocationPresetId,
  type ObserverLocation,
} from '../state/locations';
import { useSimStore } from '../state/store';
import { SPEED_PRESETS } from './speeds';

/**
 * Log-spaced distance options: a linear 0.05–1 slider would spend 95% of its travel on the
 * uninteresting end. 1× is true scale.
 */
const MOON_DISTANCE_OPTIONS = {
  '1× (true)': 1,
  '0.5×': 0.5,
  '0.25×': 0.25,
  '0.1×': 0.1,
  '0.05×': 0.05,
} as const satisfies Record<string, number>;

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

  const setVisualScale = useSimStore((s) => s.setVisualScale);
  // The panel's setter only exists after useControls returns, so the button reaches it via a ref.
  const resetAids = useRef<(() => void) | null>(null);
  const [aids, setAidsPanel] = useControls('Visual aids — NOT true scale', () => ({
    moonSize: {
      label: 'moon size ×',
      value: TRUE_SCALE.moonSize,
      min: MOON_SIZE_RANGE.min,
      max: MOON_SIZE_RANGE.max,
      step: 0.5,
    },
    moonDistance: {
      label: 'moon distance ×',
      value: TRUE_SCALE.moonDistance,
      options: MOON_DISTANCE_OPTIONS,
    },
    'reset to true scale': button(() => {
      resetAids.current?.();
    }),
  }));

  useEffect(() => {
    resetAids.current = () => {
      setAidsPanel({ ...TRUE_SCALE });
    };
  }, [setAidsPanel]);

  useEffect(() => {
    setVisualScale({ moonSize: aids.moonSize, moonDistance: aids.moonDistance });
  }, [aids.moonSize, aids.moonDistance, setVisualScale]);

  const setAuroraEnabled = useSimStore((s) => s.setAuroraEnabled);
  const flair = useControls('Flair — not simulated', {
    aurora: { label: 'aurora (cosmetic)', value: false },
  });

  useEffect(() => {
    setAuroraEnabled(flair.aurora);
  }, [flair.aurora, setAuroraEnabled]);

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
        sizes: { rootWidth: '100%', controlWidth: '55%' },
        fontSizes: { root: '12px' },
      }}
    />
  );
}
