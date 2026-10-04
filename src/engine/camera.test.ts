import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CameraRig, fixedFocusPose, pivotSpring } from './camera';
import { Animator } from './animator';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Exercise camera transitions without a browser or OrbitControls input events. */
function cameraTransition() {
  const animator = new Animator();
  const rig = Object.assign(Object.create(CameraRig.prototype) as CameraRig, {
    camera: new THREE.PerspectiveCamera(32, 1.6, 0.05, 200),
    controls: { target: V(0, 6, 0), minDistance: 0.9 },
    pivot: V(0, 6, 0), animator, mode_: 'fixed', interacting: false,
  });
  rig.camera.position.set(0, 6, 60);
  return { rig, animator };
}

describe('skull to dental camera transition', () => {
  it('keeps the orbit pivot aligned throughout the move and finishes before starting separation', () => {
    const { rig, animator } = cameraTransition();
    let ready = false;
    rig.focusSphere(V(0, 0, 0), 5, { distance: 35, direction: V(0, 0, 1), duration: 0.8, movePivot: true, done: () => { ready = true; } });
    animator.tick(0.4);
    expect(ready).toBe(false);
    expect(rig.controls.target.y).toBeGreaterThan(0);
    expect(rig.controls.target.y).toBeLessThan(6);
    expect(rig.pivot.equals(rig.controls.target)).toBe(true);
    expect(rig.tick(0.016, false)).toBe(false);
    animator.tick(0.4);
    expect(ready).toBe(true);
    expect(rig.controls.target.equals(V(0, 0, 0))).toBe(true);
    expect(rig.camera.position.distanceTo(V(0, 0, 35))).toBeLessThan(1e-10);
  });

  it('does not start separation after a cancelled preparation', () => {
    const { rig, animator } = cameraTransition();
    let ready = false;
    rig.focusSphere(V(0, 0, 0), 5, { duration: 0.8, movePivot: true, done: () => { ready = true; } });
    animator.tick(0.2);
    animator.cancel('camera');
    animator.tick(1);
    expect(ready).toBe(false);
    expect(rig.pivot.equals(rig.controls.target)).toBe(true);
    expect(rig.tick(0.016, false)).toBe(false);
  });

  it('establishes the dental frame immediately when reduced motion is requested', () => {
    const { rig, animator } = cameraTransition();
    animator.reducedMotion = true;
    let ready = false;
    rig.focusSphere(V(0, 0, 0), 5, { movePivot: true, done: () => { ready = true; } });
    expect(ready).toBe(true);
    expect(rig.pivot.equals(V(0, 0, 0))).toBe(true);
    expect(animator.active).toBe(false);
  });
});

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
