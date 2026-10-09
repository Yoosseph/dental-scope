import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Registry } from '../anatomy/registry';
import type { Engine } from '../engine/Engine';
import { actions, getState, initialState, setState } from '../state/store';
import { parsePath, startRouter } from './router';

const registry = new Registry(JSON.parse(readFileSync('public/models/manifest.json', 'utf8')));
let stop: (() => void) | undefined;
let url: URL;
let events: EventTarget;
const engine = {
  selectFromUI: vi.fn(async (id: string) => actions.select(id)),
  exploreTooth: vi.fn(async (fdi: number) => actions.enterDissect(fdi)),
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
  const navigate = (_data: unknown, _title: string, path: string) => { url = new URL(path, url); };
  vi.stubGlobal('history', { pushState: vi.fn(navigate), replaceState: vi.fn(navigate) });
  vi.stubGlobal('window', events);
  vi.stubGlobal('document', { title: '' });
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
    expect(history.pushState).not.toHaveBeenCalled();
    expect(history.replaceState).not.toHaveBeenCalled();
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

  it('closes and reopens with history navigation, then updates the link when language changes', async () => {
    stop = startRouter(engine, registry);
    actions.openCredits(true);
    expect(history.pushState).toHaveBeenCalledTimes(1);
    url = new URL('https://example.org/');
    events.dispatchEvent(new Event('popstate'));
    expect(getState().creditsOpen).toBe(false);
    url = new URL('https://example.org/credits/');
    events.dispatchEvent(new Event('popstate'));
    expect(getState().creditsOpen).toBe(true);
    actions.setLang('de');
    expect(url.pathname).toBe('/credits/de/');
    expect(history.pushState).toHaveBeenCalledTimes(1);
    expect(getState().creditsOpen).toBe(true);
  });
});
