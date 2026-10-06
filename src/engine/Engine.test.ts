import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Registry } from '../anatomy/registry';
import { actions, initialState, setState } from '../state/store';
import { Animator } from './animator';
import { CameraRig } from './camera';
import { Engine } from './Engine';

const registry = new Registry(JSON.parse(readFileSync('public/models/manifest.json', 'utf8')));

/** Reproduce an already-loaded tooth still moving home from arch/board dissection. */
function movingTooth() {
  const animator = new Animator();
  const camera = new THREE.PerspectiveCamera(32, 1440 / 900, .05, 200);
  camera.position.set(8, 6, 30);
  const rig = Object.assign(Object.create(CameraRig.prototype) as CameraRig, {
    camera, animator, controls: { target: new THREE.Vector3(8, 6, 0), minDistance: .9 },
    pivot: new THREE.Vector3(), mode_: 'free',
  });
  const entries = new Map();
  for (const key of registry.meshesOf('tooth-36')) {
    const bounds = registry.manifest.meshes[key]?.bounds;
    if (!bounds) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.boundingBox = new THREE.Box3(new THREE.Vector3(...bounds[0]), new THREE.Vector3(...bounds[1]));
    const mesh = new THREE.Mesh(geometry);
    mesh.position.set(5, 3, -2);
    entries.set(key, { mesh, visual: 'on' });
  }
  const engine = Object.assign(Object.create(Engine.prototype) as Engine, {
    registry, rig, entries, animator, disposed: false, insetsKnown: true,
    insets: { right: 0, bottom: 0, left: 0 },
    container: { clientWidth: 1440, clientHeight: 900 },
    insetTarget: { right: 0, bottom: 0, left: 0 },
    ensureTooth: vi.fn().mockResolvedValue(undefined),
  });
  return { engine, rig, animator };
}

describe('entering tooth exploration', () => {
  beforeEach(() => {
    setState({ ...initialState });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  });
  afterEach(() => { vi.unstubAllGlobals(); setState({ ...initialState }); });

  it.each([1, 2] as const)('centres the settled tooth instead of its moving position from phase %i', async (explodePhase) => {
    const { engine, rig, animator } = movingTooth();
    setState({ explode: 1, explodePhase, selectedId: 'tooth-36' });
    engine.setInsets(376, 230, 307);
    const settled = engine.boundsOf('tooth-36', true, true).getCenter(new THREE.Vector3());
    expect(engine.boundsOf('tooth-36', true).getCenter(new THREE.Vector3()).distanceTo(settled)).toBeGreaterThan(1);
    await engine.exploreTooth(36);
    animator.tick(1);
    expect(rig.controls.target.distanceTo(settled)).toBeLessThan(1e-10);
    expect(rig.pivot.distanceTo(settled)).toBeLessThan(1e-10);
    rig.camera.updateMatrixWorld();
    expect(settled.clone().project(rig.camera).x).toBeCloseTo((307 - 376) / 1440, 8);
    expect(settled.clone().project(rig.camera).y).toBeCloseTo(230 / 900, 8);
    const bounds = engine.boundsOf('tooth-36', true, true);
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const point = new THREE.Vector3(x, y, z).project(rig.camera);
      const px = (point.x + 1) * 1440 / 2, py = (1 - point.y) * 900 / 2;
      expect(px).toBeGreaterThan(307);
      expect(px).toBeLessThan(1440 - 376);
      expect(py).toBeGreaterThan(50);
      expect(py).toBeLessThan(900 - 230);
    }
  });

  it.each(['exit', 'switch'] as const)('does not steal the camera after a pending tooth load if the user chooses to %s', async (choice) => {
    const { engine, rig, animator } = movingTooth();
    let loaded!: () => void;
    engine.ensureTooth = () => new Promise<void>((resolve) => { loaded = resolve; });
    const target = rig.controls.target.clone();
    const exploring = engine.exploreTooth(36);
    if (choice === 'exit') actions.exitDissect();
    else actions.enterDissect(11);
    loaded();
    await exploring;
    expect(animator.active).toBe(false);
    expect(rig.controls.target.equals(target)).toBe(true);
  });
});

describe('sinus picking through anatomical context', () => {
  afterEach(() => setState({ ...initialState }));
  const pick = (hits: { owner: string; visual: 'on' | 'ghost'; sinus?: boolean }[]) => {
    const engine = Object.assign(Object.create(Engine.prototype) as { pick: () => string | null }, {
      developmentScene: { active: false }, rig: { camera: {} }, pointer: new THREE.Vector2(),
      raycaster: { setFromCamera() {} },
      *rayHits() { for (const entry of hits) yield { entry }; },
    });
    return engine.pick();
  };
  it.each(['maxillary', 'frontal', 'sphenoidal'])('reaches a ghosted %s sinus behind ghosted bone', (group) => {
    setState({ studyView: 'sinuses' });
    expect(pick([
      { owner: 'frontal-bone', visual: 'ghost' },
      { owner: `${group}-sinus-left`, visual: 'ghost', sinus: true },
      { owner: 'tooth-11', visual: 'on' },
    ])).toBe(`${group}-sinus-left`);
  });
  it('keeps solid bone in front of an obscured sinus selectable', () => {
    setState({ studyView: 'sinuses' });
    expect(pick([{ owner: 'frontal-bone', visual: 'on' }, { owner: 'frontal-sinus-left', visual: 'on', sinus: true }])).toBe('frontal-bone');
  });
  it('chooses the nearest of overlapping sinus volumes', () => {
    setState({ studyView: 'sinuses' });
    expect(pick([{ owner: 'sphenoidal-sinus-right', visual: 'ghost', sinus: true }, { owner: 'sphenoidal-sinus-left', visual: 'on', sinus: true }])).toBe('sphenoidal-sinus-right');
  });
  it('retains normal opaque-first picking outside sinus study', () => {
    setState({ studyView: null });
    expect(pick([{ owner: 'maxillary-sinus-left', visual: 'ghost', sinus: true }, { owner: 'tooth-11', visual: 'on' }])).toBe('tooth-11');
  });
});
