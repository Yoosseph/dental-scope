import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Registry } from '../anatomy/registry';
import type { Manifest } from '../anatomy/types';
import { actions, getState, initialState, setState } from '../state/store';
import { Engine } from './Engine';

const registry = new Registry(JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Manifest);

function viewer() {
  const load = vi.fn(() => Promise.resolve(new Map()));
  const focus = vi.fn();
  const engine: Engine = Object.assign(Object.create(Engine.prototype) as Engine, {
    registry, loader: { load }, toothLoads: new Map(), loadedTeeth: new Set(),
    developmentScene: { active: false }, disposed: false,
    addGeometries: vi.fn(), refreshAll: vi.fn(), focus,
  });
  return { engine, load, focus };
}

beforeEach(() => setState({ ...initialState }));
afterEach(() => { vi.unstubAllGlobals(); actions.resetAll(); });

describe('selection loading', () => {
  it('retries a failed tooth download without reloading the page', async () => {
    const { engine, load, focus } = viewer();
    load.mockRejectedValueOnce(new Error('offline'));
    await engine.selectFromUI('tooth-11');
    expect(getState()).toMatchObject({ selectedId: null, selectionRequest: { id: 'tooth-11', status: 'error' } });
    expect(focus).not.toHaveBeenCalled();
    await engine.retrySelection();
    expect(load).toHaveBeenCalledTimes(2);
    expect(getState()).toMatchObject({ selectedId: 'tooth-11', selectionRequest: null });
  });

  it('deduplicates concurrent loads but commits only the latest selection', async () => {
    const { engine, load, focus } = viewer();
    let resolveFirst!: () => void;
    load.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = () => resolve(new Map()); }));
    const first = engine.selectFromUI('tooth-11');
    await engine.selectFromUI('tooth-36');
    resolveFirst();
    await first;
    expect(getState().selectedId).toBe('tooth-36');
    expect(focus.mock.calls).toEqual([['tooth-36']]);
    await engine.ensureTooth(11);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it.each(['reset', 'route', 'development'] as const)('does not revive selection after %s while downloading', async choice => {
    const { engine, load, focus } = viewer();
    let finish!: () => void;
    load.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve(new Map()); }));
    const selecting = engine.selectFromUI('tooth-11');
    if (choice === 'reset') actions.resetAll();
    else if (choice === 'route') engine.cancelSelection();
    else actions.setDevelopmentStage('primary');
    finish();
    await selecting;
    expect(getState().selectedId).toBeNull();
    expect(focus).not.toHaveBeenCalled();
  });

  it('does not enter dissection when loading fails and can retry it', async () => {
    const { engine, load, focus } = viewer();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    load.mockRejectedValueOnce(new Error('offline'));
    await engine.exploreTooth(11);
    expect(getState().dissectFdi).toBeNull();
    await engine.retrySelection();
    expect(getState()).toMatchObject({ dissectFdi: 11, selectionRequest: null });
    expect(focus).toHaveBeenCalledWith('tooth-11', { restPose: true });
  });
});
