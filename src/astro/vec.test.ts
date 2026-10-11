import { MakeTime, RotateVector, Rotation_EQJ_ECL, Vector } from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { ECLIPTIC_POLE_EQJ } from './frames';
import { fromAstroRotation, mulVec, vec } from './vec';

describe('fromAstroRotation', () => {
  it('agrees with astronomy-engine RotateVector', () => {
    const r = Rotation_EQJ_ECL();
    const v = new Vector(0.3, -0.5, 0.8, MakeTime(new Date(0)));
    const theirs = RotateVector(r, v);
    const ours = mulVec(fromAstroRotation(r), vec(v.x, v.y, v.z));
    expect(ours.x).toBeCloseTo(theirs.x, 12);
    expect(ours.y).toBeCloseTo(theirs.y, 12);
    expect(ours.z).toBeCloseTo(theirs.z, 12);
  });
});

describe('ECLIPTIC_POLE_EQJ', () => {
  it('is tilted by the J2000 obliquity (IAU 2006: 84381.406″) toward −y', () => {
    const obliquity = (84381.406 / 3600) * (Math.PI / 180);
    expect(ECLIPTIC_POLE_EQJ.x).toBeCloseTo(0, 12);
    expect(ECLIPTIC_POLE_EQJ.y).toBeCloseTo(-Math.sin(obliquity), 9);
    expect(ECLIPTIC_POLE_EQJ.z).toBeCloseTo(Math.cos(obliquity), 9);
  });
});
