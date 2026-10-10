import { readFileSync } from 'node:fs';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { Registry } from '../anatomy/registry';
import { Engine } from '../engine/Engine';
import { buildIndex } from '../search/search';
import { actions, initialState, setState, type AppState } from '../state/store';
import type * as storeModule from '../state/store';
import type { Manifest } from '../anatomy/types';
import { ServicesContext } from '../ui/context';
import { DetailPanel } from '../ui/DetailPanel';
import { Dock } from '../ui/Dock';
import { LayersPanel } from '../ui/LayersPanel';
import { SearchPanel } from '../ui/SearchPanel';
import { TopActions } from '../ui/TopBar';
import { FIRST_VISIT_TOUR } from './tour';

// Server rendering otherwise reads Zustand's initial snapshot; inspect each live UI state here.
vi.mock('../state/store', async importOriginal => {
  const actual = await importOriginal<typeof storeModule>();
  return { ...actual, useApp: <T,>(selector: (state: AppState) => T) => selector(actual.getState()) };
});

const registry = new Registry(JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Manifest);
const services = { registry, engine: Object.create(Engine.prototype) as Engine, searchIndex: buildIndex(registry) };
const html = () => renderToStaticMarkup(createElement(ServicesContext.Provider, { value: services },
  createElement(Fragment, null, ...[TopActions, Dock, DetailPanel, LayersPanel, SearchPanel].map(component => createElement(component)))));

afterEach(() => setState({ ...initialState }));

it('resolves every scripted target in the real UI across development, search and dissection', () => {
  setState({ ...initialState, ready: true });
  let markup = html();
  actions.setDevelopmentStage('primary');
  markup += html();
  actions.setDevelopmentStage(null);
  actions.openSearch(true);
  actions.setSearchQuery('fdi 36');
  markup += html();
  actions.openSearch(false);
  actions.select('tooth-36');
  markup += html();
  actions.setSurfaceFeatures(true);
  markup += html();
  actions.select('surface-central-groove-36');
  markup += html();
  actions.enterDissect(36);
  markup += html();
  for (const step of FIRST_VISIT_TOUR) if (step.target) {
    expect(markup.includes(`data-tour="${step.target}"`), `Missing live control for ${step.id}`).toBe(true);
  }
  actions.exitDissect();
});
