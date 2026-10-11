import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, SRGBColorSpace, type Sprite } from 'three';
import type { BodyTransform, OrbitScene } from '../../sim/orbitScene';
import { PRIORITY, useFrameRef } from '../frame';
import { markerOpacity, sphereRadiusPx, spriteScaleForPixels } from './markerMath';

/** Ring radius in CSS pixels. */
const RING_PX = 10;
const LABEL_GAP_PX = 6;
const FONT_PX = 12;
const PIXEL_RATIO = 2;

interface MarkerArt {
  texture: CanvasTexture;
  widthPx: number;
  heightPx: number;
  /** Sprite anchor (0–1) that puts the ring's centre on the body. */
  centerX: number;
}

/** Draws a ring with the label to its right, at 2× for crispness. */
function drawMarker(label: string, color: string): MarkerArt | null {
  const font = `500 ${FONT_PX * PIXEL_RATIO}px system-ui, sans-serif`;
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) return null;
  measure.font = font;
  const textWidthPx = measure.measureText(label).width / PIXEL_RATIO;

  const ringBox = 2 * RING_PX + 4;
  const widthPx = Math.ceil(ringBox + LABEL_GAP_PX + textWidthPx + 2);
  const heightPx = ringBox;

  const canvas = document.createElement('canvas');
  canvas.width = widthPx * PIXEL_RATIO;
  canvas.height = heightPx * PIXEL_RATIO;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(PIXEL_RATIO, PIXEL_RATIO);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(ringBox / 2, heightPx / 2, RING_PX, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = `500 ${FONT_PX}px system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, ringBox + LABEL_GAP_PX, heightPx / 2 + 0.5);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return { texture, widthPx, heightPx, centerX: ringBox / 2 / widthPx };
}

interface Props {
  select: (orbit: OrbitScene) => BodyTransform;
  label: string;
  color: string;
}

/**
 * A fixed-pixel-size ring and label on a body: UI only, drawn on top, never part of the physics.
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
      RING_PX,
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
