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

/** Order-sensitive digest of a colour attribute (rounded so float noise cannot flip it). */
function digest(attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): { sum: number; weighted: number } {
  let sum = 0;
  let weighted = 0;
  for (let i = 0; i < attr.count * 3; i++) {
    const v = (attr.array as Float32Array)[i];
    sum += v;
    weighted += v * ((i % 97) + 1);
  }
  return { sum: Math.round(sum * 1e4) / 1e4, weighted: Math.round(weighted * 1e3) / 1e3 };
}

const tooth = {
  frame: { origin: [0, 0, 0], axis: [0, 1, 0], mesial: [1, 0, 0], buccal: [0, 0, 1] },
  landmarks: { 'cervical-line': [0, -0.1, 0] },
} as unknown as ManifestTooth;
const registry = { manifest: { teeth: { '36': tooth } } } as unknown as Registry;

describe('tooth shading', () => {
  it('colours a tooth shell from root to crown (unchanged output)', () => {
    const geo = bumpyGeometry();
    const mat = createTissueMaterial('shell');
    colorToothShell(geo, mat, registry, 36);
    expect(mat.userData.fx.uCervical.value.toArray()).toEqual([0, -0.1, 0]);
    expect(mat.userData.fx.uToothAxis.value.toArray()).toEqual([0, 1, 0]);
    expect(digest(geo.getAttribute('color'))).toMatchInlineSnapshot(`
      {
        "sum": 422.0161,
        "weighted": 20694.652,
      }
    `);
  });

  it('leaves a tooth without a cervical line uncoloured', () => {
    const geo = bumpyGeometry();
    colorToothShell(geo, createTissueMaterial('shell'), registry, 11);
    expect(geo.getAttribute('color')).toBeUndefined();
  });

  it('darkens enamel crevices (unchanged output)', () => {
    const geo = bumpyGeometry();
    shadeEnamelCrevices(geo);
    expect(digest(geo.getAttribute('color'))).toMatchInlineSnapshot(`
      {
        "sum": 475.9891,
        "weighted": 23279.674,
      }
    `);
  });
});
