import { useFrame } from '@react-three/fiber';
import { useState } from 'react';
import { eclipseDisplayGain } from '../sim/eclipse';
import {
  createEclipseUniforms,
  updateEclipseUniforms,
  type EclipseUniforms,
} from './eclipseShading';
import { PRIORITY, useFrameRef } from './frame';

/**
 * Eclipse uniforms for one view's Moon, refreshed every frame from the shared Frame.
 *
 * @param view Whose world axes the Moon is drawn in.
 * @param compression Display auto-exposure strength during eclipses (1 = normalise the brightest
 *   point to full; see eclipseDisplayGain).
 */
export function useEclipseUniforms(view: 'orbit' | 'sky', compression: number): EclipseUniforms {
  const frameRef = useFrameRef();
  const [uniforms] = useState(createEclipseUniforms);

  useFrame(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const gain = eclipseDisplayGain(frame.sky.eclipseIllumination, compression);
    updateEclipseUniforms(uniforms, frame.eclipse[view], gain);
  }, PRIORITY.update);

  return uniforms;
}
