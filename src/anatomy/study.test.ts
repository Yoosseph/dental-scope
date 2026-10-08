import { readFileSync, statSync } from 'node:fs';
import { describe, it, expect, beforeEach } from 'vitest';
import { Registry } from './registry';
import type { Manifest } from './types';
import { LANGS } from '../i18n/lang';
import { resolveContent } from '../content/content';
import { actions, getState, initialState, setState } from '../state/store';
import { resolveMesh, revealPatch } from '../state/visibility';
const manifest = JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Manifest;
const registry = new Registry(manifest);
const features = (fdi: number) => manifest.teeth[String(fdi)].surfaceFeatures!.map(f => f.key);

describe('tooth-specific surface teaching', () => {
  it('distinguishes upper oblique ridges, lower first-molar distal cusps and lower second-molar patterns', () => {
    expect(features(16)).toContain('oblique-ridge');
    expect(features(36)).toContain('distal-cusp');
    expect(features(37)).not.toContain('distal-cusp');
    expect(features(37)).not.toContain('oblique-ridge');
    expect(features(34)).toContain('mesiolingual-groove');
    expect(features(34)).not.toContain('central-groove');
    expect(features(13)).toContain('lingual-ridge');
    expect(features(13)).toContain('labial-ridge');
    expect(features(14)).toContain('buccal-ridge');
    expect(features(14)).toContain('mesial-marginal-groove');
    expect(features(15)).not.toContain('mesial-marginal-groove');
    expect(features(15)).toContain('buccal-triangular-ridge');
    expect(features(35)).toContain('lingual-triangular-ridge');
    expect(features(11)).not.toContain('labial-ridge');
    expect(features(11)).not.toContain('lingual-ridge');
  });
  it('uses fitted, finite landmarks with their own sourced descriptions in every language', () => {
    for (const [fdi, tooth] of Object.entries(manifest.teeth)) {
      expect(tooth.surfaceFeatures!.length).toBeGreaterThan(4);
      for (const feature of tooth.surfaceFeatures!) {
        expect(feature.anchor.every(Number.isFinite)).toBe(true);
        const id = `surface-${feature.key}-${fdi}`;
        expect(registry.require(id).parent).toBe(`crown-${fdi}`);
        for (const lang of LANGS) {
          const content = resolveContent(registry, id, lang);
          expect(content.key).toBe(`surface-${feature.key}`);
          expect(content.summary!.length).toBeGreaterThan(50);
          expect(content.sources.length).toBeGreaterThan(0);
          expect(content.status).toBe('draft');
        }
      }
    }
  });
});

describe('sinus and vessel study views', () => {
  beforeEach(() => setState({ ...initialState, categories: { ...initialState.categories } }));
  it('removes every ethmoidal air-cell entry and mesh while retaining the ethmoid bone', () => {
    expect([...registry.byId.keys()].filter(id => id.startsWith('ethmoidal-air-cells'))).toEqual([]);
    expect(Object.keys(manifest.meshes).filter(id => id.startsWith('ethmoidal-air-cells'))).toEqual([]);
    expect(registry.require('ethmoid-bone')).toBeDefined();
  });
  it('registers all three sinus groups and bilateral schematic additions', () => {
    for (const group of ['maxillary-sinus', 'frontal-sinus', 'sphenoidal-sinus']) {
      expect(registry.require(group).parent).toBe('paranasal-sinuses');
      for (const side of ['right', 'left']) {
        const structure = registry.require(`${group}-${side}`);
        expect(structure.meshes.length).toBe(1);
        for (const lang of LANGS) {
          const content = resolveContent(registry, structure.id, lang);
          expect(content.summary!.length).toBeGreaterThan(100);
          expect(content.sources.length).toBeGreaterThan(0);
          expect(content.status).toBe('draft');
        }
      }
    }
  });
  it('leaves dissection and restrictive visibility behind when applying a study preset', () => {
    actions.enterDissect(16);
    setState({ hidden: { 'maxillary-artery-right': true }, clip: { ...initialState.clip, enabled: true }, isolateId: 'tooth-16' });
    actions.applyStudyPreset('vessels');
    expect(getState().dissectFdi).toBe(null);
    expect(getState().hidden).toEqual({});
    expect(getState().clip.enabled).toBe(false);
    expect(getState().categories.arteries).toBe('on');
    expect(getState().categories.muscles).toBe('ghost');
    setState({ isolateId: 'facial-artery-left' });
    actions.setVesselSide('right'); actions.setVesselMode('veins');
    expect(getState().isolateId).toBe(null);
    const context = { registry, state: getState(), loadedTeeth: new Set<number>() };
    expect(resolveMesh('facial-artery-right', context)).toBe('off');
    expect(resolveMesh('facial-vein-left', context)).toBe('off');
    expect(resolveMesh('facial-vein-right', context)).toBe('on');
    const patch = revealPatch(registry, 'facial-artery-left', getState());
    expect(patch.vesselSide).toBe('left'); expect(patch.vesselMode).toBe('both');
    actions.applyStudyPreset('overview'); expect(getState().studyView).toBe(null);
  });
  it('opens skull context around a selected sinus while retaining solid section cuts', () => {
    const state = { ...initialState, selectedId: 'frontal-sinus-right' };
    expect(resolveMesh('frontal-bone', { registry, state, loadedTeeth: new Set() })).toBe('see-through');
    state.clip = { ...state.clip, enabled: true };
    expect(resolveMesh('frontal-bone', { registry, state, loadedTeeth: new Set() })).toBe('on');
  });
  it('keeps shipped asset sizes and file references consistent with the manifest', () => {
    for (const [file, size] of Object.entries(manifest.files!)) expect(statSync(`public/models/${file}`).size, file).toBe(size);
    for (const mesh of Object.values(manifest.meshes)) expect(statSync(`public/models/${mesh.file}`).size).toBeGreaterThan(0);
  });
});
