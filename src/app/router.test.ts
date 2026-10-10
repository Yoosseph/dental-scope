import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Registry } from '../anatomy/registry';
import type { Manifest } from '../anatomy/types';
import type { Engine } from '../engine/Engine';
import { actions, getState, initialState, setState } from '../state/store';
import { navigate, parsePath, startRouter } from './router';

const registry = new Registry(JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Manifest);
let stop: (() => void) | undefined;
let url: URL;
let events: EventTarget;
const updateUrl = (_data: unknown, _title: string, path: string) => { url = new URL(path, url); };
const pushState = vi.fn(updateUrl);
const replaceState = vi.fn(updateUrl);
const engine = {
  cancelSelection: vi.fn(),
  selectFromUI: vi.fn((id: string) => { actions.select(id); return Promise.resolve(); }),
  exploreTooth: vi.fn((fdi: number) => { actions.enterDissect(fdi); return Promise.resolve(); }),
} as unknown as Engine;

beforeEach(() => {
  setState({ ...initialState });
  url = new URL('https://example.org/');
  events = new EventTarget();
  vi.stubGlobal('location', {
    get pathname() { return url.pathname; },
    get search() { return url.search; },
    get hash() { return url.hash; },
  });
  vi.stubGlobal('history', { pushState, replaceState });
  vi.stubGlobal('window', events);
  vi.stubGlobal('document', { title: '' });
});

describe('explicit selection navigation', () => {
  it('pushes one entry per search selection instead of replacing the previous tooth', async () => {
    stop = startRouter(engine, registry);
    await navigate(() => engine.selectFromUI('tooth-36'));
    await navigate(() => engine.selectFromUI('tooth-11'));
    expect(pushState.mock.calls.map(call => call[2])).toEqual(['/tooth/36/', '/tooth/11/']);
    expect(replaceState).not.toHaveBeenCalled();
    url = new URL('https://example.org/tooth/36/');
    events.dispatchEvent(new Event('popstate'));
    await Promise.resolve();
    expect(getState().selectedId).toBe('tooth-36');
    expect(pushState).toHaveBeenCalledTimes(2);
  });

  it('commits selection and dissection as one navigation and ignores an obsolete completion', async () => {
    stop = startRouter(engine, registry);
    let finish!: () => void;
    const previous = navigate(() => new Promise<void>(resolve => { finish = resolve; }));
    await navigate(() => { actions.select('tooth-11'); actions.enterDissect(11); });
    finish();
    await previous;
    expect(pushState.mock.calls.map(call => call[2])).toEqual(['/tooth/11/dissect']);
  });
});

afterEach(() => {
  stop?.();
  stop = undefined;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('credits popup deep links', () => {
  it('accepts the root and translated links, with or without a trailing slash', () => {
    expect(parsePath('/credits', registry)).toMatchObject({ credits: true });
    expect(parsePath('/credits/', registry)).toMatchObject({ credits: true });
    for (const lang of ['sv', 'de', 'es', 'la']) {
      expect(parsePath(`/credits/${lang}/`, registry)).toMatchObject({ credits: true, lang });
      expect(parsePath(`/credits/${lang}`, registry)).toMatchObject({ credits: true, lang });
    }
    expect(parsePath('/credits/unknown/', registry).credits).toBeUndefined();
  });

  it('opens on arrival and keeps the share URL during loading and scene updates', () => {
    url = new URL('https://example.org/credits/');
    stop = startRouter(engine, registry);
    expect(getState().creditsOpen).toBe(true);
    actions.setLoading('core', 1);
    actions.select('tooth-36');
    expect(url.pathname).toBe('/credits/');
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('uses a translated link language and keeps existing viewer preferences', () => {
    setState({ theme: 'dark', numbering: 'universal' });
    url = new URL('https://example.org/credits/sv/');
    stop = startRouter(engine, registry);
    expect(getState()).toMatchObject({ creditsOpen: true, lang: 'sv', theme: 'dark', numbering: 'universal' });
    expect(url.pathname).toBe('/credits/sv/');
  });

  it('opens in place and returns to the same selected, dissected tooth when closed', () => {
    url = new URL('https://example.org/tooth/36/dissect?lang=en');
    setState({ selectedId: 'tooth-36', dissectFdi: 36 });
    stop = startRouter(engine, registry);
    // The tooth route applies asynchronously; its engine mock has applied the scene.
    return Promise.resolve().then(() => {
      actions.openCredits(true);
      expect(url.pathname).toBe('/credits/');
      expect(url.search).toBe('?lang=en');
      expect(getState()).toMatchObject({ selectedId: 'tooth-36', dissectFdi: 36 });
      actions.openCredits(false);
      expect(url.pathname).toBe('/tooth/36/dissect');
      expect(getState()).toMatchObject({ creditsOpen: false, selectedId: 'tooth-36', dissectFdi: 36 });
    });
  });

  it('closes and reopens with history navigation, then updates the link when language changes', () => {
    stop = startRouter(engine, registry);
    actions.openCredits(true);
    expect(pushState).toHaveBeenCalledTimes(1);
    url = new URL('https://example.org/');
    events.dispatchEvent(new Event('popstate'));
    expect(getState().creditsOpen).toBe(false);
    url = new URL('https://example.org/credits/');
    events.dispatchEvent(new Event('popstate'));
    expect(getState().creditsOpen).toBe(true);
    actions.setLang('de');
    expect(url.pathname).toBe('/credits/de/');
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(getState().creditsOpen).toBe(true);
  });
});
