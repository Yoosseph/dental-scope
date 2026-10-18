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

describe('quiz section', () => {
  // in Quiz every board tooth is loaded (ensureAllTeeth), so its layers resolve
  const cutVisual = (key: string, patch: Partial<AppState>) =>
    resolveMesh(key, { registry, state: { ...initialState, ...patch }, loadedTeeth: new Set([11, 36]) });
  const cut = { ...initialState.clip, enabled: true };

  it('swaps only the picked tooth for its tissues', () => {
    const picked = { mode: 'quiz' as const, clip: cut, selectedId: 'tooth-36' };
    expect(cutVisual('tooth-36', picked)).toBe('off');
    expect(cutVisual('enamel-36', picked)).toBe('on');
    // the rest of the board keeps its shells, so the cut stays local to the picked tooth
    expect(cutVisual('tooth-11', picked)).toBe('on');
    expect(cutVisual('enamel-11', picked)).toBe('off');
  });

  it('cuts nothing while no tooth is picked', () => {
    const none = { mode: 'quiz' as const, clip: cut, selectedId: null };
    expect(cutVisual('tooth-36', none)).toBe('on');
    expect(cutVisual('enamel-36', none)).toBe('off');
  });

  it('leaves the explore cutaway (every tooth opened) untouched', () => {
    const explore = { clip: cut, selectedId: 'tooth-36', dissectFdi: null };
    expect(cutVisual('tooth-11', explore)).toBe('off');
    expect(cutVisual('enamel-11', explore)).toBe('on');
  });
});
