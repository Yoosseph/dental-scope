import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Registry } from '../anatomy/registry';
import type { ManifestTooth } from '../anatomy/types';
import { createTissueMaterial } from './materials';
import { colorToothShell, shadeEnamelCrevices } from './toothShading';

/** An indexed, bumpy test surface: concave and convex vertices, like a real crown. */
function bumpyGeometry(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(0.5, 3);
  const merged = mergeVertices(geo);
  const pos = merged.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.multiplyScalar(1 + 0.08 * Math.sin(v.x * 23) * Math.cos(v.z * 17));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  merged.computeVertexNormals();
  return merged;
}

/** Minimal vertex welding (the test surface must be indexed). */
function mergeVertices(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = geo.getAttribute('position');
  const map = new Map<string, number>();
  const verts: number[] = [];
  const index: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const key = [pos.getX(i), pos.getY(i), pos.getZ(i)].map((n) => n.toFixed(5)).join(',');
    let id = map.get(key);
    if (id === undefined) {
      id = verts.length / 3;
      map.set(key, id);
      verts.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    }
    index.push(id);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  out.setIndex(index);
  return out;
}

const tooth = {
  frame: { origin: [0, 0, 0], axis: [0, 1, 0], mesial: [1, 0, 0], buccal: [0, 0, 1] },
  landmarks: { 'cervical-line': [0, -0.1, 0] },
} as unknown as ManifestTooth;
const registry = { manifest: { teeth: { '36': tooth } } } as unknown as Registry;

describe('tooth shading', () => {
  it('keeps the root warmer and darker than crown enamel', () => {
    const geo = bumpyGeometry();
    const mat = createTissueMaterial('shell');
    colorToothShell(geo, mat, registry, 36);
    expect(mat.userData.fx.uCervical.value.toArray()).toEqual([0, -0.1, 0]);
    expect(mat.userData.fx.uToothAxis.value.toArray()).toEqual([0, 1, 0]);
    const pos = geo.getAttribute('position'), color = geo.getAttribute('color');
    let rootBlue = 0, crownBlue = 0, roots = 0, crowns = 0;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) < -.25) { rootBlue += color.getZ(i); roots++; }
      if (pos.getY(i) > .1) { crownBlue += color.getZ(i); crowns++; }
    }
    expect(crownBlue / crowns - rootBlue / roots).toBeGreaterThan(.2);
  });

  it('leaves a tooth without a cervical line uncoloured', () => {
    const geo = bumpyGeometry();
    colorToothShell(geo, createTissueMaterial('shell'), registry, 11);
    expect(geo.getAttribute('color')).toBeUndefined();
  });

  it('does not paint dark grooves onto enamel, even on a bumpy mesh', () => {
    const geo = bumpyGeometry();
    shadeEnamelCrevices(geo);
    const colors = geo.getAttribute('color').array;
    expect(Math.min(...colors)).toBeGreaterThanOrEqual(.97);
    expect(Math.max(...colors)).toBeLessThanOrEqual(1);
  });

  it('gives cervical enamel subtle warmth that fades toward the cusp', () => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, -.05, 0, 0, .5, 0], 3));
    shadeEnamelCrevices(geo, registry, 36);
    const color = geo.getAttribute('color');
    expect(color.getX(0)).toBe(color.getX(1));
    expect(color.getZ(0)).toBeLessThan(color.getZ(1));
    expect(color.getZ(0)).toBeGreaterThanOrEqual(.89);
    expect(color.getZ(1)).toBe(1);
  });
});
