import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Registry } from '../anatomy/registry';
import type { Manifest } from '../anatomy/types';
import type { Engine } from '../engine/Engine';
import { buildIndex } from '../search/search';
import type * as StoreModule from '../state/store';
import { initialState, setState, type AppState } from '../state/store';
import { ServicesContext } from './context';
import { StructureTree } from './StructureTree';

vi.mock('../state/store', async importOriginal => {
  const actual = await importOriginal<typeof StoreModule>();
  return { ...actual, useApp: <T,>(selector: (state: AppState) => T) => selector(actual.getState()) };
});

const registry = new Registry(JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Manifest);
// Static rendering never calls the engine; interaction is verified in the browser.
const services = { registry, engine: {} as Engine, searchIndex: buildIndex(registry) };
const render = () => renderToStaticMarkup(createElement(ServicesContext.Provider, { value: services }, createElement(StructureTree)));
afterEach(() => setState({ ...initialState }));

describe('tree keyboard entry point', () => {
  it('has exactly one tab stop when no structure is selected', () => {
    setState({ ...initialState });
    const html = render();
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html).toContain(`data-id="${registry.require(registry.rootId).children[0]}" tabindex="0"`);
  });

  it('expands the path to a selected nested structure and makes it the tab stop', () => {
    setState({ ...initialState, selectedId: 'pulp-36' });
    const html = render();
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html).toContain('data-id="pulp-36" tabindex="0"');
  });

  it('keeps a tab stop when the selected structure is the unrendered root', () => {
    setState({ ...initialState, selectedId: registry.rootId });
    expect(render().match(/tabindex="0"/g)).toHaveLength(1);
  });
});
