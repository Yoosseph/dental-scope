import { describe, expect, it } from 'vitest';
import { LANGS } from '../i18n/lang';
import {
  GUIDE_PAGES,
  GUIDE_SUBJECTS,
  MIN_INDEX_WORDS,
  TOOTH_SUBJECTS,
  guideHtml,
  guidePage,
  guidePath,
  neighbour,
  opposing,
  otherSide,
  slugify,
  wordCount,
} from './guide';
import { headTags, robotsTxt, sitemapXml } from './seo';

const SITE = 'https://dental-scope.com/';
const tooth36 = TOOTH_SUBJECTS.find((s) => s.fdi === 36)!;

describe('slugify', () => {
  it('keeps plain ASCII words', () => {
    expect(slugify('Mandibular left first molar', 'en')).toBe('mandibular-left-first-molar');
  });
  it('spells German umlauts out and drops other accents', () => {
    expect(slugify('Zähne im Unterkiefer', 'de')).toBe('zaehne-im-unterkiefer');
    expect(slugify('Höger hörntand i överkäken', 'sv')).toBe('hoger-horntand-i-overkaken');
    expect(slugify('Anatomía (V2)', 'es')).toBe('anatomia-v2');
  });
});

describe('guide pages', () => {
  it('covers every tooth and structure in every language', () => {
    expect(TOOTH_SUBJECTS).toHaveLength(32);
    expect(GUIDE_PAGES).toHaveLength(GUIDE_SUBJECTS.length * LANGS.length);
  });
  it('puts English at the root and the other languages in their own folders, with localized sections', () => {
    expect(guidePath(tooth36, 'en')).toBe('teeth/36-mandibular-left-first-molar/');
    expect(guidePath(tooth36, 'sv')).toMatch(/^sv\/tander\/36-/);
    expect(guidePath(tooth36, 'de')).toMatch(/^de\/zaehne\/36-/);
    expect(guidePath(tooth36, 'es')).toMatch(/^es\/dientes\/36-/);
    expect(guidePath(tooth36, 'la')).toMatch(/^la\/dentes\/36-/);
  });
  it('gives every page a unique, URL-safe path', () => {
    const paths = GUIDE_PAGES.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of paths) expect(p).toMatch(/^([a-z]{2}\/)?[a-z]+\/[a-z0-9-]+\/$/);
  });
  it('keeps titles and descriptions within search result limits', () => {
    for (const p of GUIDE_PAGES) {
      expect(p.title).toContain('Dental Scope');
      expect(p.description.length).toBeLessThanOrEqual(160);
      expect(p.description.length).toBeGreaterThan(20);
    }
  });
  it('indexes a page only when its own text is long enough, and links only indexable language versions', () => {
    for (const p of GUIDE_PAGES) {
      expect(p.indexable).toBe(wordCount(p.subject, p.lang) >= MIN_INDEX_WORDS);
      if (!p.indexable) expect(p.alternates).toBeUndefined();
      else for (const l of Object.keys(p.alternates ?? {})) expect(guidePage(p.subject, l as never).indexable).toBe(true);
    }
  });
});

describe('English tooth pages', () => {
  it('have enough text to be indexed', () => {
    for (const s of TOOTH_SUBJECTS) expect(wordCount(s, 'en'), `tooth ${s.fdi}`).toBeGreaterThanOrEqual(MIN_INDEX_WORDS);
  });
  it('show the form-and-anatomy section', () => {
    const page = guidePage(tooth36, 'en');
    expect(guideHtml(page, '', '/')).toContain('<h2>Form and anatomy</h2>');
  });
});

describe('neighbouring teeth', () => {
  it('finds mesial and distal neighbours, crossing the midline between central incisors', () => {
    expect(neighbour(11, 'mesial')).toBe(21);
    expect(neighbour(31, 'mesial')).toBe(41);
    expect(neighbour(36, 'mesial')).toBe(35);
    expect(neighbour(36, 'distal')).toBe(37);
    expect(neighbour(18, 'distal')).toBeUndefined();
  });
  it('finds the same tooth on the other side and in the other jaw', () => {
    expect(otherSide(36)).toBe(46);
    expect(otherSide(21)).toBe(11);
    expect(opposing(36)).toBe(26);
    expect(opposing(14)).toBe(44);
  });
});

describe('guide html', () => {
  const page = guidePage(tooth36, 'sv');
  const html = guideHtml(page, headTags(page, SITE, { noindex: !page.indexable }), '/');
  it('is a complete page in its language with the tooth name, numbers and a link into the explorer', () => {
    expect(html).toMatch(/^<!doctype html>\n<html lang="sv">/);
    expect(html).toContain(`<h1>${tooth36.names.sv}</h1>`);
    expect(html).toContain('<dt>Universal</dt><dd>19</dd>');
    expect(html).toContain('href="/tooth/36/?lang=sv"');
  });
  it('links the same page in the other languages and the neighbouring teeth', () => {
    for (const l of LANGS) if (l !== 'sv') expect(html).toContain(`href="/${guidePath(tooth36, l)}"`);
    expect(html).toContain(`href="/${guidePath(TOOTH_SUBJECTS.find((s) => s.fdi === 37)!, 'sv')}"`);
  });
});

describe('indexing controls', () => {
  it('drops hreflang links from pages kept out of the index', () => {
    const page = { ...guidePage(tooth36, 'en'), alternates: { en: 'teeth/x/', sv: 'sv/tander/x/' } };
    expect(headTags(page, SITE, { noindex: true })).toContain('content="noindex, follow"');
    expect(headTags(page, SITE, { noindex: true })).not.toContain('hreflang');
    expect(headTags(page, SITE)).toContain('hreflang="sv"');
  });
  it('blocks every crawler on preview deployments', () => {
    expect(robotsTxt(SITE, true)).toBe('User-agent: *\nDisallow: /\n');
    expect(robotsTxt(SITE)).toContain(`Sitemap: ${SITE}sitemap.xml`);
  });
  it('lists language versions in the sitemap', () => {
    const xml = sitemapXml(SITE, ['', { path: 'teeth/x/', alternates: { en: 'teeth/x/', sv: 'sv/tander/x/' } }]);
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xml).toContain(`<xhtml:link rel="alternate" hreflang="sv" href="${SITE}sv/tander/x/"/>`);
    expect(xml).toContain(`<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}teeth/x/"/>`);
  });
});
