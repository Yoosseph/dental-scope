import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Registry } from './registry';
import type { Manifest } from './types';
import { actions, getState, initialState, setState } from '../state/store';
import { resolveMesh, revealPatch } from '../state/visibility';
import { passageFor } from './passages';
import { NERVE_VIEWS, nerveInView } from './nerveViews';

const registry = new Registry(JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Manifest);
const visible = (id: string, patch: Partial<typeof initialState> = {}) => resolveMesh(id, { registry, state: { ...initialState, ...patch }, loadedTeeth: new Set() });

describe('organized nerve display', () => {
  it('starts with dental supply and offers every nerve through a group', () => {
    expect(visible('inferior-alveolar-nerve-right')).toBe('on');
    for (const id of ['facial-nerve-right', 'ophthalmic-nerve-left', 'vagus-nerve-right']) expect(visible(id)).toBe('off');
    for (const s of registry.byId.values()) if (s.meshes.length && s.categories.includes('nerves')) {
      expect(NERVE_VIEWS.some((view) => nerveInView(registry, s.id, view, 'both')), s.id).toBe(true);
      expect(visible(s.meshes[0], { nerveView: 'all' }), s.id).toBe('on');
    }
  });
  it('filters a complete facial branch family by anatomical side', () => {
    const state = { nerveView: 'facial' as const, nerveSide: 'left' as const };
    expect(visible('facial-nerve-left', state)).toBe('on');
    expect(visible('facial-buccal-branch-left', state)).toBe('on');
    expect(visible('facial-nerve-right', state)).toBe('off');
    expect(visible('inferior-alveolar-nerve-left', state)).toBe('off');
  });
  it('search navigation reveals a hidden group and side', () => {
    const state = { ...initialState, nerveSide: 'left' as const };
    const patch = revealPatch(registry, 'facial-temporal-branch-right', state);
    expect(patch.nerveView).toBe('facial');
    expect(patch.nerveSide).toBe('right');
    expect(visible('facial-temporal-branch-right', { ...state, ...patch })).toBe('on');
    expect(revealPatch(registry, 'trigeminal-nerve-right', initialState).nerveView).toBe('trigeminal');
  });
  it('a focused passage overrides the broader group while hiding unrelated paths', () => {
    const state = { passageIds: passageFor(registry, 'facial-nerve-right'), nerveView: 'dental' as const, nerveSide: 'left' as const };
    expect(visible('facial-nerve-right', state)).toBe('on');
    expect(visible('facial-temporal-branch-right', state)).toBe('on');
    expect(visible('facial-nerve-left', state)).toBe('off');
    expect(visible('inferior-alveolar-nerve-right', state)).toBe('off');
  });
  it('group and side controls leave isolation and tooth dissection so the paths are reachable', () => {
    try {
      setState({ ...initialState });
      actions.enterDissect(36);
      actions.setNerveView('facial');
      expect(getState().dissectFdi).toBeNull();
      expect(getState().isolateId).toBeNull();
      expect(visible('facial-nerve-right', getState())).toBe('on');
      setState({ isolateId: 'hyoid-bone', passageIds: ['facial-nerve-left'] });
      actions.setNerveSide('right');
      expect(getState().isolateId).toBeNull();
      expect(getState().passageIds).toEqual([]);
      expect(visible('facial-nerve-right', getState())).toBe('on');
    } finally {
      setState({ ...initialState });
    }
  });
});
