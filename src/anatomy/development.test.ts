import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEVELOPMENT_STAGES, DEVELOPMENT_TEETH, developmentId, developmentNotation, developmentStatus, successorFdi } from './development';
import { Registry } from './registry';
import type { Manifest } from './types';
import { actions, getState, initialState, setState } from '../state/store';
import { resolveMesh } from '../state/visibility';
import { resolveContent } from '../content/content';
import { LANGS } from '../i18n/lang';

const registry = new Registry(JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Manifest);
const tooth = (fdi: number) => DEVELOPMENT_TEETH.find((t) => t.fdi === fdi)!;
const visual = (key: string) => resolveMesh(key, { registry, state: getState(), loadedTeeth: new Set() });

describe('childhood dentition timeline', () => {
  beforeEach(() => { actions.resetAll(); setState({ ...initialState }); });

  it('uses a 20-tooth primary dentition without premolars and 28 permanent teeth without wisdom teeth', () => {
    const primary = DEVELOPMENT_TEETH.filter((t) => t.dentition === 'primary');
    expect(primary).toHaveLength(20);
    expect(primary.some((t) => t.type.includes('premolar'))).toBe(false);
    expect(tooth(54).type).toBe('first-molar');
    expect(tooth(55).type).toBe('second-molar');
    expect(successorFdi(tooth(54))).toBe(14);
    expect(successorFdi(tooth(55))).toBe(15);
    expect(successorFdi(tooth(16))).toBe(null);
    expect(DEVELOPMENT_TEETH.filter((t) => t.dentition === 'permanent')).toHaveLength(28);
  });

  it('keeps early permanent buds out until calcification begins', () => {
    expect(developmentStatus(tooth(14), 'infant')).toBe('absent');
    expect(developmentStatus(tooth(17), 'toddler')).toBe('absent');
    expect(developmentStatus(tooth(16), 'infant')).toBe('unerupted');
    expect(developmentStatus(tooth(55), 'infant')).toBe('unerupted');
    expect(developmentStatus(tooth(51), 'infant')).toBe('erupting');
  });

  it('shows molars behind retained primary molars and respects upper/lower incisor timing', () => {
    expect(developmentStatus(tooth(16), 'early-mixed')).toBe('erupting');
    expect(developmentStatus(tooth(55), 'early-mixed')).toBe('primary');
    expect(developmentStatus(tooth(31), 'early-mixed')).toBe('erupting');
    expect(developmentStatus(tooth(71), 'early-mixed')).toBe('absent');
    expect(developmentStatus(tooth(11), 'early-mixed')).toBe('unerupted');
    expect(developmentStatus(tooth(51), 'early-mixed')).toBe('primary');
  });

  it('gives each primary type its own localized content instead of an adult premolar description', () => {
    for (const lang of LANGS) {
      const first = resolveContent(registry, developmentId(54), lang);
      const second = resolveContent(registry, developmentId(55), lang);
      expect(first.key).toBe('development:primary:first-molar:maxillary');
      expect(first.summary).not.toBe(second.summary);
      expect(first.sources.length).toBeGreaterThan(0);
      expect(first.status).toBe('draft');
    }
  });

  it('replaces the adult scene at every childhood stop and restores it at the adult endpoint', () => {
    actions.setCategory('muscles', 'off');
    actions.hide('tooth-36');
    const adult = getState();
    for (const stage of DEVELOPMENT_STAGES) {
      actions.setDevelopmentStage(stage.id);
      expect(visual('tooth-11')).toBe('off');
      expect(visual('mandibular-alveolar-process')).toBe('off');
      expect(visual('development-maxillary-arch')).toBe('ghost');
    }
    actions.setDevelopmentStage(null);
    expect(getState().categories).toEqual(adult.categories);
    expect(getState().hidden).toEqual(adult.hidden);
    expect(visual('tooth-11')).toBe('on');
    expect(visual('tooth-36')).toBe('off');
    expect(visual(developmentId(11))).toBe('off');
  });

  it('hides unerupted teeth without hiding erupted neighbors', () => {
    actions.setDevelopmentStage('primary');
    actions.setDevelopmentShowUnerupted(false);
    expect(visual(developmentId(11))).toBe('off');
    expect(visual(developmentId(51))).toBe('on');
    actions.setDevelopmentShowUnerupted(true);
    expect(visual(developmentId(11))).toBe('on');
  });

  it('plays all stages once, restores the adult scene and stops at the endpoint', () => {
    actions.hide('tooth-36');
    const adult = getState();
    actions.playDevelopment();
    for (const stage of DEVELOPMENT_STAGES) {
      expect(getState().developmentStage).toBe(stage.id);
      expect(getState().developmentPlaying).toBe(true);
      actions.advanceDevelopment();
    }
    expect(getState().developmentStage).toBeNull();
    expect(getState().developmentPlaying).toBe(false);
    expect(getState().hidden).toEqual(adult.hidden);
    actions.advanceDevelopment();
    expect(getState().developmentStage).toBeNull();
  });

  it('pauses on manual seeking and resumes from the paused stage', () => {
    actions.playDevelopment();
    actions.setDevelopmentStage('late-mixed');
    expect(getState().developmentPlaying).toBe(false);
    actions.advanceDevelopment();
    expect(getState().developmentStage).toBe('late-mixed');
    actions.playDevelopment();
    actions.pauseDevelopment();
    expect(getState().developmentStage).toBe('late-mixed');
    actions.playDevelopment();
    actions.advanceDevelopment();
    expect(getState().developmentStage).toBe('permanent');
    actions.setDevelopmentStage('permanent');
    expect(getState().developmentPlaying).toBe(false);
    actions.resetAll();
    expect(getState().developmentPlaying).toBe(false);
    expect(getState().developmentStage).toBeNull();
  });

  it('numbers primary teeth with the primary Universal and Palmer systems', () => {
    expect(developmentNotation(tooth(55))).toEqual({ fdi: '55', universal: 'A', palmer: 'URE' });
    expect(developmentNotation(tooth(65)).universal).toBe('J');
    expect(developmentNotation(tooth(75)).universal).toBe('K');
    expect(developmentNotation(tooth(85)).universal).toBe('T');
  });
});
