import type { ThreeElements } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import type { MeshStandardMaterial } from 'three';
import { makeEclipseAware, type EclipseBody, type EclipseUniforms } from './eclipseShading';

type Props = ThreeElements['meshStandardMaterial'] & {
  eclipse: EclipseUniforms;
  /** Which body's shadow geometry applies (default: the Moon in Earth's shadow). */
  body?: EclipseBody;
};

/** A body's meshStandardMaterial whose sunlight follows eclipse shadows (see eclipseShading.ts). */
export function EclipseAwareStandardMaterial({ eclipse, body = 'moon', ...props }: Props) {
  const material = useRef<MeshStandardMaterial>(null);
  useLayoutEffect(() => {
    if (material.current) makeEclipseAware(material.current, eclipse, body);
  }, [eclipse, body]);
  return <meshStandardMaterial ref={material} {...props} />;
}
