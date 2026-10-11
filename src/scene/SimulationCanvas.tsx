import { View } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useState, type ReactNode, type RefObject } from 'react';
import { FrameContext, type FrameRef } from './frame';
import { FrameDriver } from './FrameDriver';

interface Props {
  /** Element receiving pointer events for all views (the page's view container). */
  eventSource: RefObject<HTMLElement | null>;
  children?: ReactNode;
}

/**
 * One canvas, one render loop for every view. Views are drei <View>s placed in the DOM; they
 * render here via <View.Port />, all after <FrameDriver> has sampled the clock.
 */
export function SimulationCanvas({ eventSource, children }: Props) {
  const [frame] = useState<FrameRef>(() => ({ current: null }));

  return (
    <FrameContext.Provider value={frame}>
      <Canvas
        className="simulation-canvas"
        eventSource={eventSource}
        fallback={<p className="fallback">This simulator needs WebGL, which isn't available.</p>}
      >
        <FrameDriver />
        <View.Port />
        {children}
      </Canvas>
    </FrameContext.Provider>
  );
}
