import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Registry } from '../anatomy/registry';
import type { Manifest } from '../anatomy/types';
import { initialState } from '../state/store';
import { DevelopmentScene, developmentPoint } from './DevelopmentScene';
import { DEVELOPMENT_MORPH_SECONDS, DEVELOPMENT_STAGES } from '../anatomy/development';

const registry = new Registry(JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Manifest);

describe('developmental skull visualization', () => {
  const skull = () => {
    const source = new THREE.BoxGeometry(2, 2, 2).translate(2, 8, -2);
    const scene = new DevelopmentScene(registry);
    scene.addSource('frontal-bone', source, ['skull']);
    return { source, scene };
  };
  const currentVertex = (mesh: THREE.Mesh) => {
    const base = new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'), 0);
    const morph = mesh.geometry.morphAttributes.position?.[0];
    return morph ? base.lerp(new THREE.Vector3().fromBufferAttribute(morph, 0), mesh.morphTargetInfluences![0]) : base;
  };

  it('morphs through intermediate skull poses and retargets from the displayed pose when seeking', () => {
    const { source, scene } = skull();
    scene.update({ ...initialState, developmentStage: 'primary' });
    const beginning = currentVertex(scene.root.children[0] as THREE.Mesh);
    scene.update({ ...initialState, developmentStage: 'permanent' }, true);
    const mesh = scene.root.children[0] as THREE.Mesh;
    const end = new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'), 0);
    expect(currentVertex(mesh).distanceTo(beginning)).toBeLessThan(1e-6);
    expect(scene.timelinePosition).toBe(2);
    scene.tick(DEVELOPMENT_MORPH_SECONDS / 4);
    expect(scene.timelinePosition).toBeCloseTo(2.25);
    scene.tick(DEVELOPMENT_MORPH_SECONDS / 4);
    expect(scene.timelinePosition).toBeCloseTo(4);
    expect(currentVertex(mesh).distanceTo(beginning.clone().lerp(end, 0.5))).toBeLessThan(1e-6);
    const interrupted = currentVertex(mesh);
    scene.update({ ...initialState, developmentStage: 'infant' }, true);
    expect(scene.timelinePosition).toBeCloseTo(4);
    const next = scene.root.children[0] as THREE.Mesh;
    expect(currentVertex(next).distanceTo(interrupted)).toBeLessThan(1e-6);
    scene.tick(DEVELOPMENT_MORPH_SECONDS);
    expect(next.morphTargetInfluences![0]).toBe(0);
    expect(scene.remainingSeconds).toBe(0);
    expect(scene.timelinePosition).toBe(0);
    scene.dispose(); source.dispose();
  });

  it('pauses growth with autoplay and resumes without changing the intermediate pose', () => {
    const { source, scene } = skull();
    scene.update({ ...initialState, developmentStage: 'primary', developmentPlaying: true });
    scene.update({ ...initialState, developmentStage: 'permanent', developmentPlaying: true }, true, true);
    scene.tick(0.5);
    const mesh = scene.root.children[0] as THREE.Mesh;
    const paused = currentVertex(mesh);
    const pausedTimeline = scene.timelinePosition;
    scene.update({ ...initialState, developmentStage: 'permanent', developmentPlaying: false });
    expect(scene.tick(1)).toBe(false);
    expect(currentVertex(mesh).distanceTo(paused)).toBe(0);
    expect(scene.timelinePosition).toBe(pausedTimeline);
    scene.update({ ...initialState, developmentStage: 'permanent', developmentPlaying: true });
    expect(scene.tick(0.5)).toBe(true);
    expect(currentVertex(mesh).distanceTo(paused)).toBeGreaterThan(0);
    expect(scene.timelinePosition).toBeGreaterThan(pausedTimeline);
    scene.dispose(); source.dispose();
  });

  it('starts on the first frame and moves at constant speed through every checkpoint to adult', () => {
    const { source, scene } = skull();
    let index = 0;
    scene.update({ ...initialState, developmentStage: DEVELOPMENT_STAGES[index].id, developmentPlaying: true });
    const advance = () => {
      index++;
      scene.update({ ...initialState, developmentStage: DEVELOPMENT_STAGES[index]?.id ?? null, developmentPlaying: index < DEVELOPMENT_STAGES.length }, true, true);
    };
    const dt = 0.07; // Intentionally crosses boundaries within a frame.
    const duration = DEVELOPMENT_STAGES.length * DEVELOPMENT_MORPH_SECONDS;
    let elapsed = 0;
    while (elapsed < duration) {
      const previous = scene.timelinePosition;
      scene.tickPlayback(dt, advance);
      elapsed += dt;
      expect(scene.timelinePosition).toBeCloseTo(Math.min(elapsed / DEVELOPMENT_MORPH_SECONDS, DEVELOPMENT_STAGES.length), 6);
      expect(scene.timelinePosition).toBeGreaterThan(previous);
    }
    expect(index).toBe(DEVELOPMENT_STAGES.length);
    expect(scene.active).toBe(false);
    scene.tickPlayback(1, advance);
    expect(scene.timelinePosition).toBe(DEVELOPMENT_STAGES.length);
    expect(index).toBe(DEVELOPMENT_STAGES.length);
    scene.dispose(); source.dispose();
  });

  it('keeps reduced-motion snapshots paced and preserves their remaining time on pause', () => {
    const { source, scene } = skull();
    scene.update({ ...initialState, developmentStage: 'infant', developmentPlaying: true });
    let advances = 0;
    const advance = () => {
      advances++;
      scene.update({ ...initialState, developmentStage: 'toddler', developmentPlaying: true });
    };
    scene.tickPlayback(1, advance, true);
    expect(advances).toBe(0);
    scene.update({ ...initialState, developmentStage: 'infant' });
    scene.tickPlayback(5, advance, true);
    expect(advances).toBe(0);
    scene.update({ ...initialState, developmentStage: 'infant', developmentPlaying: true });
    scene.tickPlayback(0.91, advance, true);
    expect(advances).toBe(1);
    expect(scene.timelinePosition).toBe(1);
    scene.dispose(); source.dispose();
  });

  it('grows into original adult geometry before releasing the adult atlas', () => {
    const { source, scene } = skull();
    scene.update({ ...initialState, developmentStage: 'permanent' });
    const beginning = currentVertex(scene.root.children[0] as THREE.Mesh);
    scene.update(initialState, true, true);
    const adult = scene.root.children[0] as THREE.Mesh;
    expect(Array.from(adult.geometry.getAttribute('position').array)).toEqual(Array.from(source.getAttribute('position').array));
    expect(scene.holdsAdult).toBe(true);
    expect(scene.timelinePosition).toBe(6);
    expect(currentVertex(adult).distanceTo(beginning)).toBeLessThan(1e-6);
    scene.tick(DEVELOPMENT_MORPH_SECONDS * 0.9);
    expect(scene.holdsAdult).toBe(false);
    expect(scene.active).toBe(true);
    expect(scene.timelinePosition).toBeGreaterThan(6);
    expect(scene.timelinePosition).toBeLessThan(7);
    scene.tick(DEVELOPMENT_MORPH_SECONDS);
    expect(scene.active).toBe(false);
    expect(scene.root.children).toHaveLength(0);
    expect(scene.timelinePosition).toBe(7);
    scene.dispose(); source.dispose();
  });

  it('lets playback take over a manual morph and pause it, while a new manual seek still animates', () => {
    const { source, scene } = skull();
    scene.update({ ...initialState, developmentStage: 'primary' });
    scene.update({ ...initialState, developmentStage: 'permanent' }, true);
    scene.tick(0.4);
    const beforePlay = currentVertex(scene.root.children[0] as THREE.Mesh);
    const timelineBeforePlay = scene.timelinePosition;
    scene.update({ ...initialState, developmentStage: 'permanent', developmentPlaying: true });
    expect(currentVertex(scene.root.children[0] as THREE.Mesh).distanceTo(beforePlay)).toBeLessThan(1e-6);
    expect(scene.timelinePosition).toBeCloseTo(timelineBeforePlay);
    scene.tick(0.4);
    scene.update({ ...initialState, developmentStage: 'permanent' });
    expect(scene.tick(0.4)).toBe(false);
    scene.update({ ...initialState, developmentStage: 'infant' }, true, false);
    expect(scene.tick(0.4)).toBe(true);
    scene.dispose(); source.dispose();
  });

  it('animates primary tooth loss and successor eruption instead of replacing meshes abruptly', () => {
    const landmark = registry.manifest.teeth['31'].landmarks!['cervical-line'];
    const source = new THREE.BoxGeometry(0.5, 1.5, 0.4).translate(...landmark);
    const scene = new DevelopmentScene(registry);
    scene.addSource('tooth-31', source, ['permanent-teeth']);
    scene.update({ ...initialState, developmentStage: 'primary' });
    const successorBefore = currentVertex(scene.root.getObjectByName('growth-tooth-31') as THREE.Mesh);
    scene.update({ ...initialState, developmentStage: 'early-mixed' }, true);
    const primary = scene.root.getObjectByName('growth-tooth-71') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
    const permanent = scene.root.getObjectByName('growth-tooth-31') as THREE.Mesh;
    expect(primary.visible).toBe(true);
    expect(primary.material.opacity).toBe(1);
    scene.tick(DEVELOPMENT_MORPH_SECONDS / 2);
    expect(primary.material.opacity).toBeCloseTo(0.5);
    expect(currentVertex(permanent).distanceTo(successorBefore)).toBeGreaterThan(0.05);
    scene.tick(DEVELOPMENT_MORPH_SECONDS);
    expect(scene.root.getObjectByName('growth-tooth-71')).toBeUndefined();
    expect(permanent.morphTargetInfluences![0]).toBe(0);
    scene.dispose(); source.dispose();
  });
  it('gives younger stages a relatively larger cranium instead of uniformly shrinking the adult', () => {
    const ratios = (stage: 'infant' | 'permanent') => {
      const face = developmentPoint(new THREE.Vector3(4, 2, 2), stage).x / 4;
      const cranium = developmentPoint(new THREE.Vector3(6, 15, -7), stage).x / 6;
      return cranium / face;
    };
    expect(ratios('infant')).toBeGreaterThan(ratios('permanent'));
    expect(ratios('permanent')).toBeGreaterThan(1);
  });

  it('keeps atlas geometry immutable while rebuilding the skull, jaw and supporting tissues together', () => {
    const source = new THREE.BoxGeometry(2, 2, 2).translate(1, 8, -2);
    const original = Array.from(source.getAttribute('position').array);
    const scene = new DevelopmentScene(registry);
    scene.addSource('frontal-bone', source, ['skull']);
    scene.addSource('mandibular-alveolar-process', source, ['alveolar-bone']);
    scene.addSource('masseter-right', source, ['muscles']);
    scene.update({ ...initialState, developmentStage: 'infant' });
    expect(scene.root.children).toHaveLength(3);
    expect(scene.root.children[0].visible).toBe(true);
    expect(scene.root.children[2].visible).toBe(false);
    const meshes = scene.root.children as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>[];
    expect(Array.from(meshes[0].geometry.getAttribute('position').array)).toEqual(Array.from(meshes[2].geometry.getAttribute('position').array));
    expect(meshes[1].material.opacity).toBeLessThan(1);
    const infantHeight = scene.bounds.getSize(new THREE.Vector3()).y;
    scene.update({ ...initialState, developmentStage: 'permanent', developmentSoftTissue: true, developmentShowUnerupted: false });
    expect(scene.bounds.getSize(new THREE.Vector3()).y).toBeGreaterThan(infantHeight);
    expect(scene.root.children[2].visible).toBe(true);
    expect((scene.root.children[1] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>).material.opacity).toBe(1);
    expect(Array.from(source.getAttribute('position').array)).toEqual(original);
    scene.update(initialState);
    expect(scene.root.visible).toBe(false);
    expect(scene.root.children).toHaveLength(0);
    scene.dispose();
    source.dispose();
  });

  it('places successors in 3D using atlas frames and hides only unerupted teeth', () => {
    const landmark = registry.manifest.teeth['11'].landmarks!['cervical-line'];
    const source = new THREE.BoxGeometry(0.5, 1.5, 0.4).translate(...landmark);
    const scene = new DevelopmentScene(registry);
    scene.addSource('tooth-11', source, ['permanent-teeth']);
    scene.update({ ...initialState, developmentStage: 'primary' });
    const primary = scene.root.getObjectByName('growth-tooth-51') as THREE.Mesh;
    const permanent = scene.root.getObjectByName('growth-tooth-11') as THREE.Mesh;
    expect(primary).toBeDefined();
    expect(permanent).toBeDefined();
    expect(primary.visible).toBe(true);
    expect(permanent.visible).toBe(true);
    expect(permanent.geometry.boundingBox!.getCenter(new THREE.Vector3()).distanceTo(primary.geometry.boundingBox!.getCenter(new THREE.Vector3()))).toBeGreaterThan(0.2);
    expect(Array.from(permanent.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
    scene.update({ ...initialState, developmentStage: 'primary', developmentShowUnerupted: false });
    expect(primary.visible).toBe(true);
    expect(permanent.visible).toBe(false);
    scene.update({ ...initialState, developmentStage: 'permanent' });
    expect(scene.root.getObjectByName('growth-tooth-51')).toBeUndefined();
    expect(scene.root.getObjectByName('growth-tooth-11')?.visible).toBe(true);
    scene.dispose();
    source.dispose();
  });
});
