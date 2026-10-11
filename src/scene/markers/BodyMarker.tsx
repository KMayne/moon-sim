import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, SRGBColorSpace, type Sprite } from 'three';
import type { BodyTransform, OrbitScene } from '../../sim/orbitScene';
import { PRIORITY, useFrameRef } from '../frame';
import { markerOpacity, sphereRadiusPx, spriteScaleForPixels } from './markerMath';

/** Gap between the body's centre and the label, CSS pixels. The label fades as the body grows into it. */
const CLEARANCE_PX = 12;
const FONT_PX = 12;
const PIXEL_RATIO = 2;

interface MarkerArt {
  texture: CanvasTexture;
  widthPx: number;
  heightPx: number;
  /** Sprite anchor (0–1) that puts the body's centre at the label's left clearance. */
  centerX: number;
}

/** Draws the label, offset to the right of the body, at 2× for crispness. */
function drawMarker(label: string, color: string): MarkerArt | null {
  const font = `500 ${FONT_PX * PIXEL_RATIO}px system-ui, sans-serif`;
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) return null;
  measure.font = font;
  const textWidthPx = measure.measureText(label).width / PIXEL_RATIO;

  const widthPx = Math.ceil(CLEARANCE_PX + textWidthPx + 2);
  const heightPx = FONT_PX + 8;

  const canvas = document.createElement('canvas');
  canvas.width = widthPx * PIXEL_RATIO;
  canvas.height = heightPx * PIXEL_RATIO;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(PIXEL_RATIO, PIXEL_RATIO);
  ctx.fillStyle = color;
  ctx.font = `500 ${FONT_PX}px system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, CLEARANCE_PX, heightPx / 2 + 0.5);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return { texture, widthPx, heightPx, centerX: 0 };
}

interface Props {
  select: (orbit: OrbitScene) => BodyTransform;
  label: string;
  color: string;
}

/**
 * A fixed-pixel-size label beside a body: UI only, drawn on top, never part of the physics.
 * Fades out once the body itself is big enough on screen to see.
 */
export function BodyMarker({ select, label, color }: Props) {
  const frameRef = useFrameRef();
  const sprite = useRef<Sprite>(null);
  const art = useMemo(() => drawMarker(label, color), [label, color]);

  useEffect(
    () => () => {
      art?.texture.dispose();
    },
    [art],
  );

  useFrame(({ camera, size }) => {
    const s = sprite.current;
    const frame = frameRef.current;
    if (!s || !art || !frame) return;
    const body = select(frame.orbit);
    s.position.set(body.position.x, body.position.y, body.position.z);

    const proj11 = camera.projectionMatrix.elements[5];
    const distance = camera.position.distanceTo(s.position);
    const opacity = markerOpacity(
      sphereRadiusPx(body.radius, distance, size.height, proj11),
      CLEARANCE_PX,
    );
    s.visible = opacity > 0.01;
    s.material.opacity = opacity;

    const k = spriteScaleForPixels(1, size.height, proj11);
    s.scale.set(art.widthPx * k, art.heightPx * k, 1);
  }, PRIORITY.update);

  if (!art) return null;
  return (
    <sprite ref={sprite} center={[art.centerX, 0.5]} renderOrder={10}>
      <spriteMaterial
        map={art.texture}
        sizeAttenuation={false}
        depthTest={false}
        depthWrite={false}
        transparent
        toneMapped={false}
      />
    </sprite>
  );
}
