import type { ThreeElements } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import type { MeshStandardMaterial } from 'three';
import { makeEclipseAware, type EclipseUniforms } from './eclipseShading';

type Props = ThreeElements['meshStandardMaterial'] & { eclipse: EclipseUniforms };

/** A Moon's meshStandardMaterial whose sunlight follows Earth's shadow (see eclipseShading.ts). */
export function EclipseAwareStandardMaterial({ eclipse, ...props }: Props) {
  const material = useRef<MeshStandardMaterial>(null);
  useLayoutEffect(() => {
    if (material.current) makeEclipseAware(material.current, eclipse);
  }, [eclipse]);
  return <meshStandardMaterial ref={material} {...props} />;
}
