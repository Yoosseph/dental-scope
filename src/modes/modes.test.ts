import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { Registry } from '../anatomy/registry';
import type { Manifest } from '../anatomy/types';
import type { Engine } from '../engine/Engine';
import { actions, getState, initialState, setState } from '../state/store';
import { EXPLORE_MODE, MODES, QUIZ_MODE, quizVisibilityFilter, switchMode } from './modes';

const registry = new Registry(JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Manifest);

describe('modes registry', () => {
  it('ships Explore and Quiz; Learn and Compare stay parked', () => {
    const states = new Map(MODES.map((m) => [m.id, m.available]));
    expect(states.get('explore')).toBe(true);
    expect(states.get('quiz')).toBe(true);
    expect(states.get('learn')).toBe(false);
    expect(states.get('compare')).toBe(false);
  });

  it('explore and quiz have distinct description texts', () => {
    expect(EXPLORE_MODE.description).not.toBe(QUIZ_MODE.description);
  });
});

describe('quiz visibility filter', () => {
  const filter = quizVisibilityFilter(registry);

  it('keeps only tooth shells visible while Quiz mode is active', () => {
    const toothKeys = registry.meshesOf('tooth-16').filter((k) => !k.includes('-tissue-'));
    const tissueKey = registry.meshesOf('tooth-16').find((k) => k.includes('-tissue-'));
    const other = registry.byId.get('mandible-body')?.meshes[0];
    expect(toothKeys.length).toBeGreaterThan(0);
    for (const k of toothKeys) expect(filter(k, 'tooth-16', { ...initialState, mode: 'quiz' })).toBe('on');
    if (tissueKey) expect(filter(tissueKey, 'tooth-16', { ...initialState, mode: 'quiz' })).toBe('on'); // base resolution hides layers anyway
    if (other) expect(filter(other, 'mandible-body', { ...initialState, mode: 'quiz' })).toBe('off');
  });

  it('is a no-op outside Quiz mode', () => {
    for (const k of ['mandible-body', 'tooth-16']) {
      expect(filter(k, k === 'mandible-body' ? 'mandible-body' : 'tooth-16', initialState)).toBe('on');
    }
  });
});

describe('switchMode', () => {
  const ctx = {
    registry,
    engine: {
      ensureAllTeeth: () => Promise.resolve(),
      frameBoard: () => {},
    } as unknown as Engine,
  };
  beforeEach(() => actions.resetAll());

  it('enters and leaves Quiz mode through the store', () => {
    setState({ view: 'left', selectedId: 'tooth-11', labels: true });
    switchMode(EXPLORE_MODE, QUIZ_MODE, ctx);
    expect(getState().mode).toBe('quiz');
    expect(getState().labels).toBe(false);
    expect(getState().explodePhase).toBe(2);
    switchMode(QUIZ_MODE, EXPLORE_MODE, ctx);
    expect(getState().mode).toBe('explore');
    expect(getState().labels).toBe(true);
    expect(getState().selectedId).toBe('tooth-11');
  });

  it('re-entering restores the quiz scene with the saved session, not a stale snapshot', () => {
    switchMode(EXPLORE_MODE, QUIZ_MODE, ctx);
    switchMode(QUIZ_MODE, EXPLORE_MODE, ctx);
    setState({ view: 'inferior', labels: false });
    switchMode(EXPLORE_MODE, QUIZ_MODE, ctx);
    expect(getState().mode).toBe('quiz');
    switchMode(QUIZ_MODE, EXPLORE_MODE, ctx);
    expect(getState().view).toBe('inferior'); // from the second explore scene, not the first
  });

  it('registering the quiz filter twice is harmless (idempotent)', () => {
    switchMode(EXPLORE_MODE, QUIZ_MODE, ctx);
    switchMode(QUIZ_MODE, EXPLORE_MODE, ctx);
    switchMode(EXPLORE_MODE, QUIZ_MODE, ctx);
    expect(getState().mode).toBe('quiz');
  });
});
