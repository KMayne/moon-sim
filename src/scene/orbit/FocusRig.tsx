import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Vector3, type Camera } from 'three';
import type { Vec3 } from '../../astro/vec';
import { normalizeOrbitCamera, sameView } from '../../sim/cameraViews';
import { useSimStore, type OrbitFocus } from '../../state/store';
import { PRIORITY, useFrameRef } from '../frame';

/** The subset of OrbitControls this rig drives. */
interface Controls {
  target: Vector3;
  minDistance: number;
  update(): void;
  addEventListener(type: 'start', listener: () => void): void;
  removeEventListener(type: 'start', listener: () => void): void;
}

/** Moon close-up: this many (rendered) Moon radii from its centre. */
const MOON_VIEW_RADII = 8;
/** Lift of the Moon close-up above the Earth–Moon line, so the limb and shadow read clearly. */
const MOON_VIEW_ELEVATION = 0.35;
/** Closest approach to the focused body, in its radii. */
const MIN_DISTANCE_RADII = 1.5;

interface Pose {
  position: Vector3;
  target: Vector3;
}

interface RigState {
  last: { focus: OrbitFocus; target: Vector3 } | null;
  /** The Earth-centred camera, saved when switching to the Moon and restored on the way back. */
  earthPose: Pose | null;
  /**
   * Once the camera is the user's (they moved it, or a link placed it), it's recorded in the store
   * for the link. Until then the default framing adapts to the screen, so it isn't recorded.
   */
  recording: boolean;
}

/** Frame a newly focused body; the Moon is seen from the Earth side, where Earth's shadow falls. */
function frameFocus(
  rig: RigState,
  focus: OrbitFocus,
  camera: Camera,
  controls: Controls,
  target: Vector3,
  earth: Vec3,
  radius: number,
): void {
  if (focus === 'moon') {
    rig.earthPose = { position: camera.position.clone(), target: controls.target.clone() };
    const towardEarth = new Vector3(earth.x, earth.y, earth.z).sub(target).normalize();
    towardEarth.y += MOON_VIEW_ELEVATION;
    towardEarth.normalize();
    camera.position.copy(target).addScaledVector(towardEarth, radius * MOON_VIEW_RADII);
    controls.target.copy(target);
  } else if (rig.earthPose) {
    camera.position.copy(rig.earthPose.position);
    controls.target.copy(rig.earthPose.target);
  } else {
    controls.target.copy(target);
  }
}

/**
 * Centres the orbit view's camera on the focused body (store `orbitFocus`) and keeps it there:
 * on a switch it frames the body, then every frame it moves camera and target together with the
 * body, so you can still orbit and zoom around it while it travels. Switching back to Earth
 * restores the camera you left. On the first frame it places the camera from the store's
 * `orbitCamera` (a shared link), or frames the Moon if that's the focus.
 */
export function FocusRig() {
  const frameRef = useFrameRef();
  const controlsObj = useThree((s) => s.controls) as unknown as Controls | null;
  const rigRef = useRef<RigState>({
    last: null,
    earthPose: null,
    recording: useSimStore.getState().orbitCamera !== null,
  });

  useEffect(() => {
    if (!controlsObj) return;
    const onStart = () => {
      rigRef.current.recording = true;
    };
    controlsObj.addEventListener('start', onStart);
    return () => {
      controlsObj.removeEventListener('start', onStart);
    };
  }, [controlsObj]);

  useFrame(({ camera, controls: rawControls }) => {
    const frame = frameRef.current;
    const controls = rawControls as unknown as Controls | null;
    if (!frame || !controls) return;
    const rig = rigRef.current;
    const { orbitFocus: focus, orbitCamera, setOrbitCamera } = useSimStore.getState();
    const body = focus === 'moon' ? frame.orbit.moon : frame.orbit.earth;
    const target = new Vector3(body.position.x, body.position.y, body.position.z);
    controls.minDistance = body.radius * MIN_DISTANCE_RADII;

    if (rig.last && rig.last.focus === focus) {
      // Follow: carry the camera along with the body's motion.
      const delta = target.clone().sub(rig.last.target);
      camera.position.add(delta);
      controls.target.add(delta);
    } else if (rig.last) {
      frameFocus(rig, focus, camera, controls, target, frame.orbit.earth.position, body.radius);
    } else if (orbitCamera) {
      camera.position.set(orbitCamera.x, orbitCamera.y, orbitCamera.z).add(target);
      controls.target.copy(target);
    } else if (focus === 'moon') {
      frameFocus(rig, focus, camera, controls, target, frame.orbit.earth.position, body.radius);
      rig.earthPose = null;
    }
    controls.update();
    rig.last = { focus, target };

    if (rig.recording) {
      const offset = camera.position.clone().sub(controls.target);
      const recorded = normalizeOrbitCamera(offset);
      if (!sameView(recorded, orbitCamera)) setOrbitCamera(recorded);
    }
  }, PRIORITY.update);

  return null;
}
