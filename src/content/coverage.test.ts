import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Registry } from '../anatomy/registry';
import type { Manifest } from '../anatomy/types';
import { descriptionGaps } from './descriptionCoverage';
import { CONTENT, resolveContent } from './content';

const registry = new Registry(JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Manifest);

describe('selectable anatomy descriptions', () => {
  it('provides a localized description for every selectable structure', () => {
    expect(descriptionGaps(registry)).toEqual([]);
  });
  it('rejects a missing translation even when a fallback description exists', () => {
    const entry = CONTENT.sv['parietal-bone'];
    try {
      delete CONTENT.sv['parietal-bone'];
      expect(resolveContent(registry, 'parietal-bone-right', 'sv').summary).toBe(CONTENT.en['parietal-bone'].summary);
      expect(descriptionGaps(registry)).toContain('sv: parietal-bone-right');
    } finally {
      CONTENT.sv['parietal-bone'] = entry;
    }
  });
  it('rejects a named atlas part that silently inherits a generic parent description', () => {
    const entry = CONTENT.en['masseter-superficial'];
    try {
      delete CONTENT.en['masseter-superficial'];
      expect(resolveContent(registry, 'masseter-superficial-right').key).toBe('masseter');
      expect(descriptionGaps(registry)).toContain('en: masseter-superficial-right requires its own content entry (masseter-superficial)');
    } finally {
      CONTENT.en['masseter-superficial'] = entry;
    }
  });
});
