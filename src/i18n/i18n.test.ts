import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Registry } from '../anatomy/registry';
import type { Manifest } from '../anatomy/types';
import { STRUCTURE_DEFS } from '../anatomy/structures';
import { CATEGORIES, PRESETS } from '../anatomy/categories';
import { CONTENT, resolveContent } from '../content/content';
import { buildIndex, search } from '../search/search';
import { LANGS, MESSAGES } from './index';
import { structureNames } from './anatomy';

const manifest = JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Manifest;
const registry = new Registry(manifest);
const index = buildIndex(registry);
const top = (q: string) => search(index, registry, q, 'fdi')[0]?.id;

/** Every string (and string-returning function) in a message tree. */
function leaves(v: unknown, path = ''): [string, unknown][] {
  if (typeof v === 'function') return [[path, (v as (...a: unknown[]) => unknown)('2', '3')]];
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => leaves(x, `${path}.${k}`));
  return [[path, v]];
}

describe('interface messages', () => {
  it('every language has the same keys and no empty text', () => {
    const shape = leaves(MESSAGES.en).map(([p]) => p);
    for (const l of LANGS) {
      const ls = leaves(MESSAGES[l]);
      expect(ls.map(([p]) => p), l).toEqual(shape);
      for (const [p, v] of ls) expect(typeof v === 'string' ? v.trim().length : 1, `${l}${p}`).toBeGreaterThan(0);
    }
  });
  it('covers every category, group and preset', () => {
    for (const l of LANGS) {
      for (const c of CATEGORIES) {
        expect(MESSAGES[l].category[c.id], `${l} ${c.id}`).toBeTruthy();
        expect(MESSAGES[l].group[c.group], `${l} ${c.group}`).toBeTruthy();
      }
      for (const p of PRESETS) expect(MESSAGES[l].preset[p.id], `${l} ${p.id}`).toBeTruthy();
    }
  });
});

describe('anatomical names', () => {
  it('every defined structure has a name in every language', () => {
    for (const d of STRUCTURE_DEFS) expect(structureNames(d.id, d.name), d.id).toBeDefined();
  });
  it('every registry structure has names in all languages', () => {
    for (const s of registry.byId.values()) for (const l of LANGS) expect(s.names[l], `${s.id} ${l}`).toBeTruthy();
  });
  it('names teeth and their parts', () => {
    expect(registry.get('tooth-36')!.names).toEqual({
      en: 'Mandibular left first molar',
      sv: 'Vänster första molar i underkäken',
      de: 'Erster Molar im Unterkiefer links',
      es: 'Primer molar inferior izquierdo',
      la: 'Dens molaris primus inferior sinister',
    });
    expect(registry.get('enamel-36')!.names.es).toBe('Esmalte');
    expect(registry.get('enamel-36')!.names.la).toBe('Enamelum');
    expect(registry.get('inferior-alveolar-nerve-right')!.names.es).toBe('Nervio alveolar inferior (lado derecho)');
    expect(registry.get('inferior-alveolar-nerve-right')!.names.la).toBe('Nervus alveolaris inferior (lateris dextri)');
    expect(registry.get('enamel-36')!.names.de).toBe('Zahnschmelz');
    expect(registry.get('inferior-alveolar-nerve-right')!.names.sv).toBe('Nervus alveolaris inferior (höger)');
  });
});

describe('content', () => {
  it('every language has the same content entries and fields as English', () => {
    for (const l of LANGS) {
      expect(Object.keys(CONTENT[l]).sort(), l).toEqual(Object.keys(CONTENT.en).sort());
      for (const [k, e] of Object.entries(CONTENT.en)) {
        const t = CONTENT[l][k];
        for (const f of ['summary', 'function', 'clinical', 'roots', 'canals', 'eruption'] as const) expect(f in t, `${l} ${k}.${f}`).toBe(f in e);
      }
    }
  });
  it('resolves content in the interface language', () => {
    expect(resolveContent(registry, 'enamel-36', 'sv').summary).toMatch(/^Kronans yttre hölje/);
    expect(resolveContent(registry, 'tooth-36', 'de').facts.map((f) => f.label)).toContain('Typische Wurzeln');
  });
});

describe('search in Spanish and Latin', () => {
  it('finds structures by their Spanish and Latin names', () => {
    expect(top('muela del juicio')).toMatch(/^tooth-\d8$/);
    expect(top('diente 36')).toBe('tooth-36');
    expect(top('encía')).toMatch(/^gingiva/);
    expect(top('esmalte')).toMatch(/^enamel-/);
    expect(top('conducto radicular')).toMatch(/canal/);
    expect(top('dens serotinus')).toMatch(/^tooth-\d8$/);
    expect(top('enamelum')).toMatch(/^enamel-/);
    expect(top('nervus alveolaris inferior')).toMatch(/^inferior-alveolar-nerve/);
  });
  it('resolves Spanish and Latin content', () => {
    expect(resolveContent(registry, 'enamel-36', 'es').summary).toMatch(/^La cubierta externa de la corona/);
    expect(resolveContent(registry, 'tooth-36', 'la').facts.map((f) => f.label)).toContain('Radices typicae');
  });
});

describe('search in Swedish and German', () => {
  it('finds structures by their translated and everyday names', () => {
    expect(top('visdomstand')).toMatch(/^tooth-\d8$/);
    expect(top('Weisheitszahn')).toMatch(/^tooth-\d8$/);
    expect(top('tand 36')).toBe('tooth-36');
    expect(top('zahn 36')).toBe('tooth-36');
    expect(top('tandkött')).toMatch(/^gingiva/);
    expect(top('Zahnfleisch')).toMatch(/^gingiva/);
    expect(top('käkled')).toMatch(/^tmj/);
    expect(top('Kiefergelenk')).toMatch(/^tmj/);
    expect(top('Unterkiefer')).toMatch(/^mandible/);
    expect(top('emalj')).toMatch(/^enamel-/);
    expect(top('Wurzelkanal')).toMatch(/canal/);
    expect(top('Schläfenbein')).toMatch(/^temporal-bone/);
  });
  it('every suggestion chip finds something', () => {
    for (const l of LANGS) for (const q of MESSAGES[l].suggestions) expect(top(q), `${l}: ${q}`).toBeDefined();
  });
});

describe('about page in every language', () => {
  it('builds with its own language, head tags and hreflang links', async () => {
    const { ABOUT_PAGES, headTags } = await import('../app/seo');
    const { aboutHtml } = await import('../app/about');
    for (const page of ABOUT_PAGES) {
      expect(page.description.length, page.path).toBeLessThanOrEqual(160);
      const html = aboutHtml(headTags(page, 'https://example.org/'), '/', '/favicon.svg', page.lang);
      expect(html).toContain(`<html lang="${page.lang}">`);
      expect(html).toContain('hreflang="sv" href="https://example.org/about/sv/"');
      expect(html).not.toContain('undefined');
      for (const fdi of [11, 36, 48]) expect(html).toContain(`/tooth/${fdi}/`);
    }
    const sv = aboutHtml('', '/', '/favicon.svg', 'sv');
    expect(sv).toContain('Vänster första molar i underkäken');
    expect(sv).toContain('/tooth/36/?lang=sv');
    const de = aboutHtml('', '/', '/favicon.svg', 'de');
    expect(de).toContain('Erster Molar im Unterkiefer links');
    const es = aboutHtml('', '/', '/favicon.svg', 'es');
    expect(es).toContain('Primer molar inferior izquierdo');
    expect(es).toContain('/tooth/36/?lang=es');
    const la = aboutHtml('', '/', '/favicon.svg', 'la');
    expect(la).toContain('Dens molaris primus inferior sinister');
  });
});
