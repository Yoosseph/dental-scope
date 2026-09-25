import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Registry } from '../anatomy/registry';
import type { Manifest } from '../anatomy/types';
import { buildIndex, parseToothQuery, search } from './search';

const manifest = JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Manifest;
const registry = new Registry(manifest);
const index = buildIndex(registry);
const top = (q: string, sys: 'fdi' | 'universal' | 'palmer' = 'fdi') => search(index, registry, q, sys)[0]?.id;

describe('registry', () => {
  it('has 32 teeth with internal layers', () => {
    expect(registry.teeth()).toHaveLength(32);
    expect(registry.get('tooth-36')?.tooth?.layers).toContain('enamel-36');
    expect(registry.get('pulp-chamber-36')?.parent).toBe('pulp-36');
  });
  it('resolves every manifest mesh to an owner', () => {
    for (const key of Object.keys(manifest.meshes)) expect(registry.meshOwner.has(key), key).toBe(true);
  });
});

describe('search', () => {
  it('interprets tooth numbers in the active system first', () => {
    expect(top('11')).toBe('tooth-11');
    expect(top('11', 'universal')).toBe('tooth-23');
    expect(top('tooth 8')).toBe('tooth-11');
    expect(top('#19')).toBe('tooth-36');
    expect(top('UR6')).toBe('tooth-16');
    expect(parseToothQuery('36', 'fdi').map((r) => r.fdi)).toEqual([36]);
  });
  it('finds anatomy by name and synonyms', () => {
    expect(top('mandibular nerve')).toMatch(/mandibular-nerve-branches|inferior-alveolar-nerve/);
    expect(top('inferior alveolar nerve')).toMatch(/^inferior-alveolar-nerve-/);
    expect(top('gums')).toBe('gingiva');
    expect(top('wisdom tooth')).toMatch(/^tooth-(18|28|38|48)$/);
    expect(top('enamel')).toBe('enamel-36');
    expect(top('pulp')).toMatch(/pulp/);
    expect(top('root canal')).toMatch(/canal/);
    expect(top('first molar')).toMatch(/^tooth-(16|26|36|46)$/);
    expect(top('maxillary right central incisor')).toBe('tooth-11');
  });
});
