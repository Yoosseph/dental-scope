import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nerveViewFor } from '../anatomy/nerveViews';
import { Registry } from '../anatomy/registry';
import type { Manifest } from '../anatomy/types';
import { LANGS } from '../i18n/lang';
import { CONTENT, resolveContent } from './content';
import { GUIDE_LABELS, toothGuide } from './toothGuides';

const manifest = JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Manifest;
const registry = new Registry(manifest);
const toothKeys = Object.keys(CONTENT.en).filter((k) => k.startsWith('tooth:'));

describe('tooth nerve supply and identification guides', () => {
  it('covers every permanent tooth type in both arches, translated', () => {
    expect(toothKeys).toHaveLength(16);
    for (const key of toothKeys) {
      const en = toothGuide(key, 'en')!;
      expect(en.map((g) => g.rows.length), key).toEqual([4, 3]);
      for (const lang of LANGS.filter((l) => l !== 'en')) {
        const guide = toothGuide(key, lang)!;
        expect(guide.flatMap((g) => g.rows).every((r) => r.value.trim()), `${lang}: ${key}`).toBe(true);
        // translated, not copied: the identification text always differs from English
        expect(guide[1].rows[0].value, `${lang}: ${key}`).not.toBe(en[1].rows[0].value);
      }
    }
  });

  it('names the palatal gum in the upper arch and the tongue side gum in the lower arch', () => {
    expect(toothGuide('tooth:first-molar:maxillary', 'en')![0].rows[2].label).toBe(GUIDE_LABELS.en.palatal);
    expect(toothGuide('tooth:first-molar:mandibular', 'en')![0].rows[2].label).toBe(GUIDE_LABELS.en.lingual);
  });

  it('gives the side rule for the way each arch is held', () => {
    expect(toothGuide('tooth:first-molar:mandibular', 'en')![1].rows[2].value).toContain('crown up');
    expect(toothGuide('tooth:central-incisor:maxillary', 'en')![1].rows[2].value).toContain('crown down with the lip side');
  });

  it('shows the guides and their sources in a tooth’s details, but not in its parts', () => {
    const tooth = resolveContent(registry, 'tooth-36', 'sv');
    expect(tooth.guides.map((g) => g.title)).toEqual([GUIDE_LABELS.sv.nerves, GUIDE_LABELS.sv.identify]);
    expect(tooth.sources.some((s) => s.url.includes('NBK564368'))).toBe(true);
    expect(resolveContent(registry, 'enamel-36', 'sv').guides).toEqual([]);
  });
});

describe('palatal nerves', () => {
  it('are selectable, schematic dental V2 branches on both sides', () => {
    for (const side of ['right', 'left']) for (const base of ['greater-palatine-nerve', 'nasopalatine-nerve']) {
      const s = registry.get(`${base}-${side}`)!;
      expect(s.kind, s.id).toBe('mesh');
      expect(s.provenance, s.id).toBe('schematic');
      expect(registry.isDescendant(s.id, 'maxillary-nerve-branches'), s.id).toBe(true);
      expect(nerveViewFor(registry, s.id), s.id).toBe('dental');
    }
  });

  it('end where their teeth are: the nasopalatine nerve behind the central incisors, the greater palatine nerve beside the premolars', () => {
    const lm = (fdi: number) => manifest.teeth[String(fdi)].landmarks!;
    for (const [side, q] of [['right', 1], ['left', 2]] as const) {
      const np = manifest.paths[`nasopalatine-nerve-${side}`][0];
      const foramen = np.at(-1)!;
      expect(Math.abs(foramen[0])).toBeLessThan(0.2);
      expect(foramen[2]).toBeLessThan(lm(q * 10 + 1)['cervical-line'][2]);
      expect(foramen[2]).toBeGreaterThan(lm(q * 10 + 4)['cervical-line'][2]);
      const gp = manifest.paths[`greater-palatine-nerve-${side}`];
      expect(gp).toHaveLength(4); // trunk and branches to the 7, 6 and 5
      expect(Math.sign(gp[0].at(-1)![0])).toBe(side === 'right' ? -1 : 1);
    }
  });
});
