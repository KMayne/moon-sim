import { useTexture } from '@react-three/drei';
import { Suspense } from 'react';
import { Quaternion, SRGBColorSpace, Vector3, type Texture } from 'three';
import { ErrorBoundary } from '../../ErrorBoundary';
import type { OrbitScene } from '../../sim/orbitScene';
import { GREENWICH_POINT, NEAR_SIDE_POINT } from '../bodyLocal';
import type { EclipseBody, EclipseUniforms } from '../eclipseShading';
import { EclipseAwareStandardMaterial } from '../EclipseAwareStandardMaterial';
import { TEXTURE_URLS } from '../textures';
import { useEclipseUniforms } from '../useEclipseUniforms';
import { OrbitBody } from './OrbitBody';

const selectEarth = (o: OrbitScene) => o.earth;
const selectMoon = (o: OrbitScene) => o.moon;

const UP = new Vector3(0, 1, 0);

interface SurfaceSpikeProps {
  /** Unit vector in the body's local frame. */
  at: Vector3;
  length: number;
  color: string;
}

/** A pin standing out of a unit sphere along `at`, so it reads at any zoom. */
function SurfaceSpike({ at, length, color }: SurfaceSpikeProps) {
  const orientation = new Quaternion().setFromUnitVectors(UP, at);
  const centre = at.clone().multiplyScalar(1 + length / 2);
  return (
    <group position={centre} quaternion={orientation}>
      <mesh>
        <cylinderGeometry args={[0.03, 0.03, length, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0, length / 2, 0]}>
        <sphereGeometry args={[0.08, 12, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

/** Lat/long grid slightly above the surface, so spin is visible without a texture. */
function Graticule({ color }: { color: string }) {
  return (
    <mesh scale={1.002}>
      <sphereGeometry args={[1, 24, 12]} />
      <meshBasicMaterial color={color} wireframe transparent opacity={0.25} />
    </mesh>
  );
}

interface SurfaceProps {
  url: string;
  roughness: number;
  /** Sunlight follows eclipse shadows: Earth's on the Moon, or the Moon's on Earth. */
  eclipse?: EclipseUniforms | undefined;
  body?: EclipseBody;
}

/** meshStandardMaterial, eclipse-aware when given eclipse uniforms. */
function SurfaceMaterial({
  eclipse,
  body = 'moon',
  ...props
}: Omit<SurfaceProps, 'url'> & { map?: Texture; color?: string }) {
  return eclipse ? (
    <EclipseAwareStandardMaterial eclipse={eclipse} body={body} metalness={0} {...props} />
  ) : (
    <meshStandardMaterial metalness={0} {...props} />
  );
}

/**
 * Equirectangular map on a unit sphere. three's SphereGeometry UVs put lon 0 at the local +x axis,
 * matching our body-frame convention (verified in textureMapping.test.ts).
 */
function TexturedSurface({ url, roughness, eclipse, body }: SurfaceProps) {
  const map = useTexture(url, (t) => {
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
  });
  return (
    <mesh>
      <sphereGeometry args={[1, 96, 48]} />
      <SurfaceMaterial map={map} roughness={roughness} eclipse={eclipse} {...(body && { body })} />
    </mesh>
  );
}

interface PlainProps {
  color: string;
  gridColor: string;
  eclipse?: EclipseUniforms | undefined;
  body?: EclipseBody;
}

/** Plain sphere plus grid: shown while the texture loads, or instead of it if loading fails. */
function PlainSurface({ color, gridColor, eclipse, body }: PlainProps) {
  return (
    <>
      <mesh>
        <sphereGeometry args={[1, 64, 32]} />
        <SurfaceMaterial color={color} roughness={1} eclipse={eclipse} {...(body && { body })} />
      </mesh>
      <Graticule color={gridColor} />
    </>
  );
}

function Surface({ url, roughness, eclipse, body, ...plain }: SurfaceProps & PlainProps) {
  const fallback = <PlainSurface {...plain} eclipse={eclipse} {...(body && { body })} />;
  return (
    <ErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <TexturedSurface
          url={url}
          roughness={roughness}
          eclipse={eclipse}
          {...(body && { body })}
        />
      </Suspense>
    </ErrorBoundary>
  );
}

export function Earth() {
  // The Moon's shadow during solar eclipses. No auto-exposure (compression 0): the shadow should
  // read as the dark spot it is.
  const eclipse = useEclipseUniforms('orbit', 0);
  return (
    <OrbitBody select={selectEarth}>
      <Surface
        url={TEXTURE_URLS.earth}
        roughness={0.9}
        color="#2a5d9f"
        gridColor="#9fc3ff"
        eclipse={eclipse}
        body="earth"
      />
      <SurfaceSpike at={GREENWICH_POINT} length={0.25} color="#ffd34d" />
    </OrbitBody>
  );
}

export function Moon() {
  // Auto-exposed during eclipses, like a telescope camera, so the eclipsed Moon shows its colour.
  const eclipse = useEclipseUniforms('orbit', 1);
  return (
    <OrbitBody select={selectMoon}>
      <Surface
        url={TEXTURE_URLS.moon}
        roughness={1}
        color="#9a9a9a"
        gridColor="#dddddd"
        eclipse={eclipse}
      />
      <SurfaceSpike at={NEAR_SIDE_POINT} length={0.6} color="#ff4d4d" />
    </OrbitBody>
  );
}
