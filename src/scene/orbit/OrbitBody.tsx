import { useFrame } from '@react-three/fiber';
import { useRef, type ReactNode } from 'react';
import type { Group } from 'three';
import type { BodyTransform, OrbitScene } from '../../sim/orbitScene';
import { applyTransform } from '../applyTransform';
import { PRIORITY, useFrameRef } from '../frame';

interface Props {
  select: (orbit: OrbitScene) => BodyTransform;
  /** Unit-radius content in the body's local frame. */
  children: ReactNode;
}

/** A group that follows one body's transform from the current frame. */
export function OrbitBody({ select, children }: Props) {
  const frameRef = useFrameRef();
  const group = useRef<Group>(null);

  useFrame(() => {
    if (group.current && frameRef.current)
      applyTransform(group.current, select(frameRef.current.orbit));
  }, PRIORITY.update);

  return <group ref={group}>{children}</group>;
}
