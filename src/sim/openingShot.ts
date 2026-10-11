import { cross, dot, normalize, scale, sub, vec, type Vec3 } from '../astro/vec';

/**
 * Framing for the orbit view's opening shot, in scene (three, Y-up) coordinates with the camera
 * looking at Earth at the origin.
 */
export interface OpeningShotInput {
  /** Viewport width / height. */
  aspect: number;
  /** Vertical field of view, degrees. */
  fovDeg: number;
  /** Radius to frame, scene units (the lunar orbit at true scale). */
  orbitRadius: number;
  /** Where the Sun disc is drawn. */
  sunPosition: Vec3;
  /** Fraction of the view width the orbit should span. */
  widthFraction?: number;
  /** Farthest the camera may sit (OrbitControls maxDistance). */
  maxDistance?: number;
}

export interface OpeningShot {
  position: Vec3;
  /** Degrees above the ecliptic plane. */
  elevationDeg: number;
  /** Degrees around ecliptic north from the anti-Sun direction. */
  azimuthDeg: number;
  /** The Sun's position in normalised device coordinates (−1…1 is on screen). */
  sunNdc: { x: number; y: number };
  /** Widest horizontal NDC extent of the orbit (≈ widthFraction when fitted). */
  orbitHalfWidthNdc: number;
  /** Whether the Sun landed inside the safe area. */
  sunInFrame: boolean;
}

const DEG = Math.PI / 180;
const UP = vec(0, 1, 0);
const ORBIT_SAMPLES = 48;
/** Keep the Sun and orbit this far inside the edges (NDC). */
const SUN_SAFE = 0.85;
const ORBIT_SAFE_Y = 0.95;
/**
 * Where we'd like the Sun to land (NDC). Its height on screen effectively sets the camera's
 * elevation, which must be enough (~15°+) for the orbit to read as an open ellipse. Wide views:
 * beside and above the orbit; narrow (portrait) views have no room beside it, so above.
 */
const sunTarget = (aspect: number) => (aspect >= 1 ? { x: 0.6, y: 0.5 } : { x: 0, y: 0.65 });

function project(camera: Vec3, aspect: number, tanHalfV: number, point: Vec3) {
  const forward = normalize(scale(camera, -1));
  const right = normalize(cross(forward, UP));
  const up = cross(right, forward);
  const v = sub(point, camera);
  const depth = dot(v, forward);
  return {
    depth,
    x: dot(v, right) / (depth * tanHalfV * aspect),
    y: dot(v, up) / (depth * tanHalfV),
  };
}

function orbitExtent(camera: Vec3, aspect: number, tanHalfV: number, radius: number) {
  let maxX = 0;
  let maxY = 0;
  for (let i = 0; i < ORBIT_SAMPLES; i++) {
    const t = (2 * Math.PI * i) / ORBIT_SAMPLES;
    const p = project(camera, aspect, tanHalfV, vec(radius * Math.cos(t), 0, radius * Math.sin(t)));
    if (p.depth <= 0) return { maxX: Infinity, maxY: Infinity };
    maxX = Math.max(maxX, Math.abs(p.x));
    maxY = Math.max(maxY, Math.abs(p.y));
  }
  return { maxX, maxY };
}

const directionFor = (azimuthDeg: number, elevationDeg: number): Vec3 => {
  const a = azimuthDeg * DEG;
  const e = elevationDeg * DEG;
  // Azimuth 0 = directly opposite the Sun (−x); positive swings toward +z.
  return vec(-Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a));
};

/** Distance along `dir` at which the orbit spans `widthFraction` of the width (bisection). */
function fitDistance(
  dir: Vec3,
  input: Required<OpeningShotInput>,
  tanHalfV: number,
): number | null {
  const extentAt = (d: number) =>
    orbitExtent(scale(dir, d), input.aspect, tanHalfV, input.orbitRadius).maxX;
  let lo = input.orbitRadius * 1.05;
  let hi = input.maxDistance;
  if (extentAt(hi) > input.widthFraction) return null;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (extentAt(mid) > input.widthFraction) lo = mid;
    else hi = mid;
  }
  return hi;
}

/**
 * Chooses where the camera starts so the lunar orbit spans ~`widthFraction` of the view width and
 * the Sun is on screen, near a target spot: beside the orbit on wide screens, above it on narrow
 * ones. A coarse grid over camera azimuth/elevation, each fitted to width by bisection (~10 ms).
 */
export function fitOpeningShot(params: OpeningShotInput): OpeningShot {
  const input: Required<OpeningShotInput> = { widthFraction: 0.85, maxDistance: 1000, ...params };
  const tanHalfV = Math.tan((input.fovDeg * DEG) / 2);

  const target = sunTarget(input.aspect);
  let best: { shot: OpeningShot; score: number } | null = null;
  for (let elevation = 4; elevation <= 70; elevation += 3) {
    for (let azimuth = 0; azimuth <= 80; azimuth += 4) {
      const dir = directionFor(azimuth, elevation);
      const distance = fitDistance(dir, input, tanHalfV);
      if (distance === null) continue;
      const camera = scale(dir, distance);
      const extent = orbitExtent(camera, input.aspect, tanHalfV, input.orbitRadius);
      const sun = project(camera, input.aspect, tanHalfV, input.sunPosition);
      const sunInFrame =
        sun.depth > 0 && Math.abs(sun.x) <= SUN_SAFE && Math.abs(sun.y) <= SUN_SAFE;
      if (extent.maxY > ORBIT_SAFE_Y) continue;

      // Shots with the Sun on screen first; among them, the Sun closest to its target spot.
      const score = (sunInFrame ? 1000 : 0) - Math.hypot(sun.x - target.x, sun.y - target.y);
      if (!best || score > best.score) {
        best = {
          score,
          shot: {
            position: camera,
            elevationDeg: elevation,
            azimuthDeg: azimuth,
            sunNdc: { x: sun.x, y: sun.y },
            orbitHalfWidthNdc: extent.maxX,
            sunInFrame,
          },
        };
      }
    }
  }
  if (!best) throw new Error('No opening shot fits; check maxDistance against orbitRadius');
  return best.shot;
}
