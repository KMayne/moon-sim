/**
 * Where each view's camera is pointing, in a form a link can carry. `null` in the store means "the
 * view's own default" (equator-facing sky; fitted opening shot / Moon close-up in the orbit view),
 * which adapts to the viewer's screen, so it's only replaced once someone actually moves a camera.
 */

/** The sky view's look direction and zoom. */
export interface SkyLook {
  /** Degrees clockwise from north, 0–360. */
  readonly azimuthDeg: number;
  readonly altitudeDeg: number;
  /** Vertical field of view, degrees. */
  readonly fovDeg: number;
}

export const SKY_ALTITUDE_RANGE = { min: -10, max: 89.5 } as const;
export const SKY_FOV_RANGE = { min: 10, max: 100 } as const;
export const DEFAULT_SKY_ALTITUDE = 20;
export const DEFAULT_SKY_FOV = 70;

/** Equator-facing: south from the northern hemisphere, north from the southern. */
export const defaultSkyLook = (latitude: number): SkyLook => ({
  azimuthDeg: latitude >= 0 ? 180 : 0,
  altitudeDeg: DEFAULT_SKY_ALTITUDE,
  fovDeg: DEFAULT_SKY_FOV,
});

/**
 * The orbit camera as an offset from the body it's centred on (scene units), so it carries over
 * as that body moves. Its length is the zoom.
 */
export interface OrbitCamera {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** OrbitControls' maxDistance in the orbit view. */
export const MAX_ORBIT_CAMERA_DISTANCE = 1000;

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

const roundTo = (n: number, places: number): number => {
  const k = 10 ** places;
  // `+ 0` turns -0 into 0, so a value at rest serialises the same however it got there.
  return Math.round(n * k) / k + 0;
};

/** Normalised and rounded the way a link carries it, so an unchanged view compares equal. */
export function normalizeSkyLook({ azimuthDeg, altitudeDeg, fovDeg }: SkyLook): SkyLook {
  const az = roundTo(((azimuthDeg % 360) + 360) % 360, 1);
  return {
    azimuthDeg: az === 360 ? 0 : az,
    altitudeDeg: roundTo(clamp(altitudeDeg, SKY_ALTITUDE_RANGE.min, SKY_ALTITUDE_RANGE.max), 1),
    fovDeg: roundTo(clamp(fovDeg, SKY_FOV_RANGE.min, SKY_FOV_RANGE.max), 1),
  };
}

/** Three decimals: the Moon close-up sits only a couple of scene units from the Moon. */
export const normalizeOrbitCamera = ({ x, y, z }: OrbitCamera): OrbitCamera => ({
  x: roundTo(x, 3),
  y: roundTo(y, 3),
  z: roundTo(z, 3),
});

export const sameView = <T extends object>(a: T | null, b: T | null): boolean =>
  a === b ||
  (a !== null && b !== null && Object.keys(a).every((k) => a[k as keyof T] === b[k as keyof T]));

function parseTriple(text: string | null): [number, number, number] | undefined {
  const parts = text?.split(',').map(Number);
  if (parts?.length !== 3 || !parts.every(Number.isFinite)) return undefined;
  return parts as [number, number, number];
}

/** `azimuth,altitude,fov` in degrees; out-of-range altitude or zoom → undefined. */
export function parseSkyLook(text: string | null): SkyLook | undefined {
  const parts = parseTriple(text);
  if (!parts) return undefined;
  const [azimuthDeg, altitudeDeg, fovDeg] = parts;
  const inRange = (v: number, r: { min: number; max: number }) => v >= r.min && v <= r.max;
  if (!inRange(altitudeDeg, SKY_ALTITUDE_RANGE) || !inRange(fovDeg, SKY_FOV_RANGE)) {
    return undefined;
  }
  return normalizeSkyLook({ azimuthDeg, altitudeDeg, fovDeg });
}

export const formatSkyLook = (look: SkyLook): string => {
  const { azimuthDeg, altitudeDeg, fovDeg } = normalizeSkyLook(look);
  return `${azimuthDeg},${altitudeDeg},${fovDeg}`;
};

/** `x,y,z` offset; a zero or too-distant offset → undefined. */
export function parseOrbitCamera(text: string | null): OrbitCamera | undefined {
  const parts = parseTriple(text);
  if (!parts) return undefined;
  const [x, y, z] = parts;
  const distance = Math.hypot(x, y, z);
  if (distance === 0 || distance > MAX_ORBIT_CAMERA_DISTANCE) return undefined;
  return normalizeOrbitCamera({ x, y, z });
}

export const formatOrbitCamera = (camera: OrbitCamera): string => {
  const { x, y, z } = normalizeOrbitCamera(camera);
  return `${x},${y},${z}`;
};
