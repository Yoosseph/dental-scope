import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { archOffset } from '../engine/explode';
import { styleKeyFor } from '../engine/materials';
import { Registry } from './registry';
import type { Manifest } from './types';

const manifest = JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Manifest;
const registry = new Registry(manifest);
const all = [...registry.byId.values()];

describe('dental focus of nerves and vessels (issues #26, #27)', () => {
  it('marks only nerve and vessel trunks as regional, and never labels them on their own', () => {
    const regional = all.filter((s) => s.regional);
    expect(regional.length).toBeGreaterThan(0);
    for (const s of regional) {
      expect(s.categories.some((c) => c === 'nerves' || c === 'arteries' || c === 'veins'), s.id).toBe(true);
      expect(s.labelPriority, s.id).toBeLessThan(3);
    }
  });

  it('keeps the dental nerves and vessels at full strength', () => {
    for (const id of ['inferior-alveolar-nerve-right', 'lingual-nerve-left', 'posterior-superior-alveolar-nerve-right', 'inferior-alveolar-artery-left', 'inferior-alveolar-vein-right'])
      expect(registry.get(id)?.regional, id).toBeFalsy();
  });

  it('labels nerves ahead of vessels', () => {
    const top = (cat: string) => Math.max(...all.filter((s) => s.kind === 'mesh' && s.categories.includes(cat as never)).map((s) => s.labelPriority));
    expect(top('nerves')).toBeGreaterThan(top('arteries'));
    expect(top('nerves')).toBeGreaterThan(top('veins'));
  });

  it('no longer has the external jugular vein', () => {
    expect(registry.get('external-jugular-vein-right')).toBeUndefined();
    expect(Object.keys(manifest.meshes).some((k) => k.startsWith('external-jugular-vein'))).toBe(false);
  });
});

describe('maxillary sinus (issue #25)', () => {
  it('is a selectable, modelled structure on each side with its own layer', () => {
    for (const side of ['right', 'left']) {
      const s = registry.get(`maxillary-sinus-${side}`);
      expect(s?.kind).toBe('mesh');
      expect(s?.provenance).toBe('modeled');
      expect(s?.categories).toEqual(['sinus']);
      expect(s?.meshes).toEqual([`maxillary-sinus-${side}`]);
      expect(styleKeyFor(`maxillary-sinus-${side}`, s!.categories)).toBe('sinus');
    }
  });

  it('sits inside its maxilla, above the upper teeth', () => {
    for (const side of ['right', 'left'] as const) {
      const [lo, hi] = manifest.meshes[`maxillary-sinus-${side}`].bounds;
      const [mlo, mhi] = manifest.meshes[`maxilla-${side}`].bounds;
      for (let a = 0; a < 3; a++) {
        expect(lo[a]).toBeGreaterThanOrEqual(mlo[a] - 0.3);
        expect(hi[a]).toBeLessThanOrEqual(mhi[a] + 0.3);
      }
      const molar = manifest.meshes[`tooth-${side === 'right' ? 16 : 26}`].bounds;
      expect(lo[1]).toBeGreaterThan(molar[0][1]);
      expect(manifest.sinus?.[side].volume).toBeGreaterThan(3);
    }
  });

  it('moves with the maxilla when the jaws are dissected', () => {
    const c = new THREE.Vector3();
    expect(archOffset(registry, 'maxillary-sinus-right', c)).toEqual(archOffset(registry, 'maxilla-right', c));
  });
});
