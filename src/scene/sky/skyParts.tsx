import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, SRGBColorSpace, type DirectionalLight } from 'three';
import { NIGHT_FLOOR_MAX, nightFloorWeight } from '../../sim/groundLight';
import { PRIORITY, useFrameRef } from '../frame';
import { GroundMaterial } from './groundMaterial';
import { SKY_RENDER_ORDER } from './renderOrder';

const GROUND_RADIUS = 50_000;
/** Eye height above the flat ground, in sky-view units (metres to the atmosphere). */
const EYE_HEIGHT = 2;

/** Sunlight for the Moon. Direction only: it follows the true Sun every frame. */
export function SkySunLight() {
  const frameRef = useFrameRef();
  const light = useRef<DirectionalLight>(null);
  useFrame(() => {
    const frame = frameRef.current;
    if (!frame || !light.current) return;
    const d = frame.sky.sunDirection;
    light.current.position.set(d.x, d.y, d.z);
  }, PRIORITY.update);
  return <directionalLight ref={light} intensity={2.5} />;
}

/**
 * Flat generic ground. Its lighting comes from the atmosphere (see groundMaterial.ts); this mesh adds
 * occlusion, texture and the display-only night floor that keeps the horizon legible.
 */
export function Ground() {
  const material = useMemo(() => new GroundMaterial(EYE_HEIGHT), []);
  useEffect(
    () => () => {
      material.dispose();
    },
    [material],
  );

  const frameRef = useFrameRef();
  useFrame(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const w = nightFloorWeight(frame.sky.sun.altitude);
    material.setFloor(NIGHT_FLOOR_MAX.ground * w, NIGHT_FLOOR_MAX.groundHorizon * w);
  }, PRIORITY.update);

  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-EYE_HEIGHT} renderOrder={SKY_RENDER_ORDER.ground}>
      <circleGeometry args={[GROUND_RADIUS, 96]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function labelTexture(text: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.font = '600 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(230, 232, 239, 0.85)';
    ctx.fillText(text, 32, 34);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

const COMPASS = [
  ['N', 0],
  ['E', 90],
  ['S', 180],
  ['W', 270],
] as const;
const LABEL_DISTANCE = 1000;
const LABEL_ALTITUDE_DEG = 1.5;

/** N/E/S/W just above the horizon. Canvas-drawn sprites: no font downloads. */
export function CompassLabels() {
  const labels = useMemo(
    () =>
      COMPASS.map(([text, azDeg]) => {
        const az = (azDeg * Math.PI) / 180;
        const alt = (LABEL_ALTITUDE_DEG * Math.PI) / 180;
        // Sky world: +x north, +y up, +z east.
        const position: [number, number, number] = [
          LABEL_DISTANCE * Math.cos(alt) * Math.cos(az),
          LABEL_DISTANCE * Math.sin(alt),
          LABEL_DISTANCE * Math.cos(alt) * Math.sin(az),
        ];
        return { text, position, texture: labelTexture(text) };
      }),
    [],
  );
  useEffect(
    () => () => {
      for (const l of labels) l.texture.dispose();
    },
    [labels],
  );
  return (
    <>
      {labels.map((l) => (
        <sprite
          key={l.text}
          position={l.position}
          scale={[0.035, 0.035, 1]}
          renderOrder={SKY_RENDER_ORDER.overlay}
        >
          <spriteMaterial
            map={l.texture}
            sizeAttenuation={false}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      ))}
    </>
  );
}
