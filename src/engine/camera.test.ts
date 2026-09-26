import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { fixedFocusPose, pivotSpring } from './camera';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

describe('fixed orbit: focus keeps the pivot', () => {
  const pivot = V(0, 0.2, 0);
  it('keeps the target on the pivot and puts the structure between camera and pivot', () => {
    const center = V(2, 1, 1.5);
    const { target, position } = fixedFocusPose(pivot, center, 0.6, 4, V(0, 0, 1));
    expect(target.equals(pivot)).toBe(true);
    // structure centre lies on the camera → pivot line (on screen centre) …
    const toPivot = pivot.clone().sub(position).normalize();
    const toCenter = center.clone().sub(position).normalize();
    expect(toPivot.angleTo(toCenter)).toBeLessThan(1e-6);
    // … in front of the pivot, at the fitted distance
    expect(position.distanceTo(center)).toBeCloseTo(4, 5);
    expect(position.distanceTo(pivot)).toBeGreaterThan(center.distanceTo(pivot));
  });
  it('uses the given direction for a structure at the pivot', () => {
    const { target, position } = fixedFocusPose(pivot, pivot.clone(), 1, 5, V(0, 0, 2));
    expect(target.equals(pivot)).toBe(true);
    expect(position.clone().sub(pivot).normalize().z).toBeCloseTo(1, 5);
    expect(position.distanceTo(pivot)).toBeCloseTo(5, 5);
  });
});

describe('fixed orbit: pivot spring', () => {
  it('moves target and camera by the same amount, so the view direction is kept', () => {
    const target = V(1, 0, 0);
    const camera = V(1, 0, 5);
    const d = pivotSpring(target, V(0, 0, 0), 0.016, false);
    expect(d.length()).toBeGreaterThan(0);
    expect(d.length()).toBeLessThan(1);
    const t2 = target.clone().add(d);
    const c2 = camera.clone().add(d);
    expect(c2.clone().sub(t2).normalize().equals(V(0, 0, 1))).toBe(true);
  });
  it('converges and snaps with reduced motion', () => {
    const t = V(1, 0, 0);
    for (let i = 0; i < 120; i++) t.add(pivotSpring(t, V(0, 0, 0), 1 / 60, false));
    expect(t.length()).toBeLessThan(1e-3);
    expect(pivotSpring(V(1, 2, 3), V(0, 0, 0), 0.016, true).equals(V(-1, -2, -3))).toBe(true);
  });
});
