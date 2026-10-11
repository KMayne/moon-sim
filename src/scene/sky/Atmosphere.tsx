import { ScreenQuad } from '@react-three/drei';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { PrecomputedTexturesLoader, StarsGeometry } from '@takram/three-atmosphere';
import { useEffect, useMemo, useRef } from 'react';
import { FileLoader, type Points } from 'three';
import { NIGHT_FLOOR_MAX, nightFloorWeight } from '../../sim/groundLight';
import { moonSkyLightScale, sunSkyLightScale } from '../../sim/moonlight';
import { skyExposure, starExposure } from '../../sim/skyExposure';
import { applyRotation } from '../applyTransform';
import { PRIORITY, useFrameRef } from '../frame';
import { DisplaySkyMaterial, DisplayStarsMaterial } from './atmosphereMaterials';
import { SKY_RENDER_ORDER } from './renderOrder';
import { setWorldToEcef } from './worldToEcef';

const ASSETS = `${import.meta.env.BASE_URL}atmosphere/`;

class ArrayBufferFileLoader extends FileLoader {
  constructor() {
    super();
    this.setResponseType('arraybuffer');
  }
}

/**
 * Physically based sky (Bruneton precomputed scattering) and the Yale Bright Star Catalogue, via
 * takram's materials. Every direction they use comes from our SkyScene — takram's own date-based
 * ephemeris is never used — so the sky, stars, Sun disc and our Moon all agree.
 */
export function Atmosphere() {
  const gl = useThree((s) => s.gl);
  const textures = useLoader(PrecomputedTexturesLoader, ASSETS, (loader) => {
    loader.setType(gl);
  });
  const starsData = useLoader(ArrayBufferFileLoader, `${ASSETS}stars.bin`) as ArrayBuffer;

  const sky = useMemo(() => new DisplaySkyMaterial(), []);
  const starsMaterial = useMemo(() => new DisplayStarsMaterial(), []);
  const starsGeometry = useMemo(() => new StarsGeometry(starsData), [starsData]);
  useEffect(
    () => () => {
      sky.dispose();
      starsMaterial.dispose();
      starsGeometry.dispose();
    },
    [sky, starsMaterial, starsGeometry],
  );

  useEffect(() => {
    for (const material of [sky, starsMaterial]) Object.assign(material, textures);
  }, [sky, starsMaterial, textures]);

  const frameRef = useFrameRef();
  const stars = useRef<Points>(null);
  useFrame(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const {
      sunDirectionEcef: sun,
      moonDirectionEcef: moon,
      skyToEcef,
      observerEcefM,
      eqjToSky,
    } = frame.sky;
    const sunAltitude = frame.sky.sun.altitude;
    const exposure = skyExposure(sunAltitude, frame.sky.moonlightOnGround);
    const floor = nightFloorWeight(sunAltitude);
    sky.setSkyFloor(NIGHT_FLOOR_MAX.skyHorizon * floor, NIGHT_FLOOR_MAX.skyZenith * floor);
    const moonScale = moonSkyLightScale(
      frame.sky.lunarToSolar,
      frame.sky.moon.altitude,
      sunAltitude,
    );
    const sunScale = sunSkyLightScale(sunAltitude);
    sky.setMoonlight(moon.x, moon.y, moon.z, moonScale);
    sky.setSunScale(sunScale);
    sky.setExposure(exposure);
    starsMaterial.setLighting(moon, moonScale, sunScale);
    starsMaterial.setExposure(exposure, starExposure(exposure));
    for (const material of [sky, starsMaterial]) {
      material.sunDirection.set(sun.x, sun.y, sun.z);
      setWorldToEcef(material.worldToECEFMatrix, skyToEcef, observerEcefM);
    }
    // Star positions are J2000 (EQJ) directions: rotate them onto the observer's sky.
    if (stars.current) applyRotation(stars.current, eqjToSky);
  }, PRIORITY.update);

  return (
    <>
      <ScreenQuad renderOrder={SKY_RENDER_ORDER.sky}>
        <primitive object={sky} attach="material" />
      </ScreenQuad>
      <points ref={stars} frustumCulled={false} renderOrder={SKY_RENDER_ORDER.stars}>
        <primitive object={starsGeometry} attach="geometry" />
        <primitive object={starsMaterial} attach="material" />
      </points>
    </>
  );
}
