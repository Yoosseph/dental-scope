import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Registry } from '../anatomy/registry';
import type { Manifest } from '../anatomy/types';
import { archOffset } from './explode';

const manifest = JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Manifest;
const registry = new Registry(manifest);

/** Mesh bounds after full arch explode. */
function exploded(key: string): THREE.Box3 {
  const [lo, hi] = manifest.meshes[key].bounds;
  const box = new THREE.Box3(new THREE.Vector3(...lo), new THREE.Vector3(...hi));
  return box.translate(archOffset(registry, key, box.getCenter(new THREE.Vector3())));
}

const crowns = Object.keys(manifest.meshes).filter((k) => /^enamel-\d\d$/.test(k));

describe('arch explode: orbicularis oris', () => {
  const lips = exploded('orbicularis-oris');

  it('clears every tooth crown when seen from the front', () => {
    expect(crowns).toHaveLength(32);
    for (const k of crowns) {
      const c = exploded(k);
      const overlapX = lips.min.x < c.max.x && lips.max.x > c.min.x;
      const overlapY = lips.min.y < c.max.y && lips.max.y > c.min.y;
      expect(overlapX && overlapY, k).toBe(false);
    }
  });

  it('stays in front of the lower incisors, just below their crowns', () => {
    const lipsCenter = lips.getCenter(new THREE.Vector3());
    for (const c of ['enamel-31', 'enamel-41'].map(exploded)) {
      expect(lips.max.y).toBeLessThan(c.min.y);
      expect(lips.max.y).toBeGreaterThan(c.min.y - 0.5);
      expect(lipsCenter.z).toBeGreaterThan(c.max.z);
    }
    // centred on the midline like the intact muscle
    expect(Math.abs(lipsCenter.x)).toBeLessThan(0.3);
  });
});
