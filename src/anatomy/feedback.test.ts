import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { beforeEach, describe, expect, it } from 'vitest';
import { Registry } from './registry';
import type { Manifest } from './types';
import { landmarkHost, passageFor } from './passages';
import { PERMANENT_FDI } from './notation';
import { canalFrequency, frequencyContext } from '../content/canalFrequency';
import data from '../content/canal-counts.json';
import { resolveContent } from '../content/content';
import { LANGS } from '../i18n/lang';
import { jawDeformation, jawMatrix, rigidJawPart } from '../engine/jawMotion';
import { actions, initialState, getState, setState } from '../state/store';
import { resolveMesh } from '../state/visibility';
import { GUIDE_REDIRECTS, GUIDE_SUBJECTS, guideHtml, guidePage } from '../app/guide';

const manifest = JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Manifest;
const registry = new Registry(manifest);

describe('sourced canal frequencies', () => {
  it('covers all permanent teeth with counts that reconcile to each sample', () => {
    expect(Object.keys(data.entries)).toHaveLength(16);
    for (const fdi of PERMANENT_FDI) {
      const item = canalFrequency(fdi)!;
      expect(item.n, String(fdi)).toBeGreaterThan(0);
      expect(item.counts.reduce((a, b) => a + b, 0)).toBe(item.n);
      expect(item.rows.reduce((a, b) => a + b.percent, 0)).toBeCloseTo(100);
      expect(item.source.url).toMatch(/^https:\/\/doi.org\//);
      for (const lang of LANGS) expect(frequencyContext(fdi, lang).every(Boolean)).toBe(true);
    }
  });
  it('matches the published study totals and keeps third-molar definitions separate', () => {
    expect(Object.values(data.entries).filter((e) => e.source === 'monsarrat2016').reduce((n, e) => n + e.n, 0)).toBe(2424);
    expect(canalFrequency(18)?.counts).toEqual([35, 68, 310, 167, 12]);
    expect(canalFrequency(38)?.counts).toEqual([7, 188, 356, 87, 1]);
    expect(canalFrequency(18)?.source.definition).toBe('maximum');
    expect(canalFrequency(16)?.source.definition).toBe('observed');
    expect(canalFrequency(16)).toEqual(canalFrequency(26));
  });
  it('renders the statistics and evidence in translated static guides', () => {
    const tooth = GUIDE_SUBJECTS.find((s) => s.fdi === 36)!;
    for (const lang of LANGS) {
      const html = guideHtml(guidePage(tooth, lang), '', '/');
      expect(html).toContain('class="canal-counts"');
      expect(html).toContain('10.1371/journal.pone.0165329');
    }
    expect(GUIDE_REDIRECTS[0].path).toBe('sv/anatomi/kakhalor/');
    expect(GUIDE_REDIRECTS[0].to).toBe('sv/anatomi/bihalor-i-overkaken/');
  });
});

describe('cranial paths and landmarks', () => {
  it('ships each added nerve and connects all three trigeminal divisions', () => {
    for (const side of ['right', 'left']) {
      for (const base of ['ophthalmic', 'facial', 'hypoglossal', 'glossopharyngeal', 'vagus']) {
        const id = `${base}-nerve-${side}`;
        expect(registry.get(id)?.kind).toBe('mesh');
        expect(manifest.meshes[id].provenance).toBe('schematic');
        expect(manifest.paths[id][0].length).toBeGreaterThan(2);
        for (const lang of LANGS) {
          const content = resolveContent(registry, id, lang);
          expect(content.summary).toBeTruthy();
          expect(content.sources.length).toBeGreaterThan(0);
          expect(content.status).toBe('draft');
        }
      }
      const root = manifest.paths[`trigeminal-nerve-${side}`][0];
      expect(root.length).toBeGreaterThan(8);
      for (const division of ['ophthalmic', 'maxillary', 'mandibular']) {
        expect(manifest.paths[`${division}-nerve-${side}`][0][0]).toEqual(root[root.length - 1]);
      }
    }
  });
  it('navigates between nerves and passages on the same side', () => {
    const route = passageFor(registry, 'mental-foramen-right');
    expect(route).toContain('inferior-alveolar-nerve-right');
    expect(route).toContain('mandibular-canal-right');
    expect(route.every((id) => id.endsWith('-right'))).toBe(true);
    expect(resolveContent(registry, 'mental-nerve-right').related).toContain('mental-foramen-right');
    expect(resolveContent(registry, 'mental-foramen-right').related).toContain('mental-nerve-right');
    expect(passageFor(registry, 'jugular-foramen-left')).toContain('vagus-nerve-left');
    for (const base of ['ophthalmic-nerve', 'maxillary-nerve', 'mandibular-nerve', 'superior-orbital-fissure', 'foramen-rotundum', 'foramen-ovale']) expect(passageFor(registry, 'trigeminal-nerve-right')).toContain(`${base}-right`);
    expect(passageFor(registry, 'tooth-36')).toEqual([]);
  });
  it('attaches landmarks to their supporting bone rather than the mandible globally', () => {
    expect(landmarkHost(registry, 'mental-foramen-right')).toBe('mandible-body');
    expect(landmarkHost(registry, 'mandibular-foramen-left')).toBe('mandible-body');
    expect(landmarkHost(registry, 'infraorbital-foramen-left')).toBe('maxilla-left');
    expect(landmarkHost(registry, 'foramen-ovale-right')).toBe('sphenoid-bone');
    expect(landmarkHost(registry, 'articular-eminence-left')).toBe('temporal-bone-left');
  });
  it('focuses a passage while leaving muscle and bone context available', () => {
    const state = { ...initialState, passageIds: passageFor(registry, 'mental-nerve-right') };
    const ctx = { registry, state, loadedTeeth: new Set<number>() };
    expect(resolveMesh('mental-nerve-right', ctx)).toBe('on');
    expect(resolveMesh('mental-nerve-left', ctx)).toBe('off');
    expect(resolveMesh('mandible-body', ctx)).toBe('see-through');
    setState(state);
    actions.select('mental-foramen-right');
    expect(getState().passageIds).toEqual(state.passageIds);
    actions.select('facial-nerve-right');
    expect(getState().passageIds).toEqual([]);
  });
});

describe('jaw movement', () => {
  beforeEach(() => setState({ ...initialState }));
  it('closes exactly at the source pose and opens anteriorly and inferiorly', () => {
    expect(jawMatrix(manifest, 0)).toEqual(new THREE.Matrix4());
    expect(jawMatrix(manifest, -1)).toEqual(new THREE.Matrix4());
    expect(jawMatrix(manifest, 2)).toEqual(jawMatrix(manifest, 1));
    const pivot = new THREE.Vector3(...manifest.jawMotion!.pivot);
    const moved = pivot.clone().applyMatrix4(jawMatrix(manifest, 1));
    expect(moved.y).toBeLessThan(pivot.y);
    expect(moved.z).toBeGreaterThan(pivot.z);
    const a = new THREE.Vector3(0, -2, 3), b = new THREE.Vector3(1, -1, 2);
    const distance = a.distanceTo(b);
    a.applyMatrix4(jawMatrix(manifest, 1)); b.applyMatrix4(jawMatrix(manifest, 1));
    expect(a.distanceTo(b)).toBeCloseTo(distance);
  });
  it('moves lower teeth and supporting tissue together, while retaining skull nerve attachments', () => {
    for (const key of ['mandible-body', 'mandibular-condyle-right', 'mandibular-alveolar-process', 'mandibular-canal-left', 'gingiva-lower']) expect(rigidJawPart(key)).toBe('mandible');
    expect(rigidJawPart('enamel-36', 36)).toBe('mandible');
    expect(rigidJawPart('enamel-16', 16)).toBeUndefined();
    expect(rigidJawPart('mandibular-nerve-right')).toBeUndefined();
    expect(rigidJawPart('articular-disc-left')).toBe('disc');
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 2, 1, 0, -2, 3], 3));
    geo.setAttribute('jaw', new THREE.Float32BufferAttribute([1, 0], 1)); geo.computeBoundingBox();
    const delta = jawDeformation(geo, 'nerve', manifest, true);
    expect([...delta.slice(0, 3)].every((v) => v === 0)).toBe(true);
    expect(Math.abs(delta[4])).toBeGreaterThan(0);
    expect([...delta].every(Number.isFinite)).toBe(true);
  });
  it('keeps opening, dissection, and arch layouts mutually exclusive', () => {
    actions.enterDissect(36); actions.setJawOpening(0.7);
    expect(getState().dissectFdi).toBeNull();
    expect(getState().jawOpening).toBe(0.7);
    actions.setExplodePhase(2);
    expect(getState().jawOpening).toBe(0);
    expect(getState().jawControls).toBe(false);
    actions.setJawOpening(1, true); actions.enterDissect(16);
    expect(getState().jawPlaying).toBe(false);
    actions.openJawControls(false);
    expect(getState().jawControls).toBe(false);
    actions.resetAll();
    expect(getState().jawOpening).toBe(0);
  });
});
