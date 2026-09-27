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

it('keeps each maxillary alveolar partition with its source maxilla', () => {
  for (const side of ['left', 'right']) {
    const maxilla = `maxilla-${side}`;
    const alveolar = `maxillary-alveolar-process-${side}`;
    const bounds = manifest.meshes[maxilla].bounds;
    const center = new THREE.Box3(new THREE.Vector3(...bounds[0]), new THREE.Vector3(...bounds[1])).getCenter(new THREE.Vector3());
    expect(archOffset(registry, alveolar, center).toArray()).toEqual(archOffset(registry, maxilla, center).toArray());
  }
});

describe('arch explode: tiers', () => {
  const center = (key: string) => {
    const [lo, hi] = manifest.meshes[key].bounds;
    return new THREE.Vector3(...lo).add(new THREE.Vector3(...hi)).multiplyScalar(0.5);
  };
  const off = (key: string) => archOffset(registry, key, center(key));

  it('keeps each articular disc in its fossa', () => {
    for (const side of ['left', 'right']) expect(off(`articular-disc-${side}`).toArray()).toEqual(off(`articular-fossa-${side}`).toArray());
  });

  it('slides each tooth out of its gum along its own axis', () => {
    for (const fdi of [11, 26, 36, 43]) {
      const t = manifest.teeth[String(fdi)];
      const gum = off(fdi < 30 ? 'gingiva-upper' : 'gingiva-lower');
      const expected = gum.clone().addScaledVector(new THREE.Vector3(...t.frame.axis), t.extract!);
      expect(off(`tooth-${fdi}`).distanceTo(expected)).toBeLessThan(1e-9);
      // every internal layer moves with its tooth
      expect(off(`enamel-${fdi}`).toArray()).toEqual(off(`tooth-${fdi}`).toArray());
    }
  });

  it('separates the upper teeth from the lower teeth', () => {
    const upper = crowns.filter((k) => Number(k.slice(-2)) < 30).map(exploded);
    const lower = crowns.filter((k) => Number(k.slice(-2)) > 30).map(exploded);
    const upperMin = Math.min(...upper.map((b) => b.min.y));
    const lowerMax = Math.max(...lower.map((b) => b.max.y));
    expect(upperMin).toBeGreaterThan(lowerMax - 0.6); // crowns interleave at most slightly in their bounds
  });

  it('keeps nerves and vessels at the mandible offset (the engine stretches them toward the skull)', () => {
    for (const k of ['inferior-alveolar-nerve-right', 'maxillary-artery-left', 'pterygoid-plexus-right']) {
      expect(off(k).toArray()).toEqual(off('mandible-body').toArray());
    }
  });
});
