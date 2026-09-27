import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Registry } from '../anatomy/registry';
import type { Manifest } from '../anatomy/types';
import { initialState, type AppState } from './store';
import { resolveMesh } from './visibility';

const manifest = JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Manifest;
const registry = new Registry(manifest);
const visual = (key: string, patch: Partial<AppState> = {}) =>
  resolveMesh(key, { registry, state: { ...initialState, ...patch }, loadedTeeth: new Set() });

describe('see-through bone', () => {
  it('turns bone see-through while a nerve or vessel layer is on', () => {
    expect(initialState.categories.nerves).toBe('on');
    for (const k of ['mandible-body', 'mandibular-alveolar-process', 'maxilla-right']) expect(visual(k)).toBe('see-through');
  });

  it('keeps bone solid when the nerve and vessel layers are off', () => {
    const categories = { ...initialState.categories, nerves: 'off', arteries: 'off', veins: 'ghost' } as AppState['categories'];
    expect(visual('mandible-body', { categories })).toBe('on');
  });

  it('keeps bone solid while sectioning and on the laid-out board', () => {
    expect(visual('mandible-body', { clip: { ...initialState.clip, enabled: true } })).toBe('on');
    expect(visual('mandible-body', { explodePhase: 2 })).toBe('on');
  });

  it('does not affect teeth, gum or the nerves themselves', () => {
    expect(visual('tooth-36')).toBe('on');
    expect(visual('gingiva-lower')).toBe('on');
    expect(visual('inferior-alveolar-nerve-right')).toBe('on');
  });
});
