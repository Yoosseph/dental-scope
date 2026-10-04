import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Registry } from '../anatomy/registry';
import type { Manifest } from '../anatomy/types';
import { ABOUT, HOME, documentTitle, headTags, normalizeSiteUrl, robotsTxt, sitemapXml, structuredData, toothPage } from './seo';
import { aboutHtml } from './about';

const registry = new Registry(JSON.parse(readFileSync('public/models/manifest.json', 'utf8')) as Manifest);

describe('normalizeSiteUrl', () => {
  it('accepts absolute http(s) URLs and adds a trailing slash', () => {
    expect(normalizeSiteUrl('https://yoosseph.github.io/dental-scope')).toBe('https://yoosseph.github.io/dental-scope/');
    expect(normalizeSiteUrl('https://example.org/')).toBe('https://example.org/');
  });
  it('rejects unset, relative or non-http values', () => {
    expect(normalizeSiteUrl(undefined)).toBeNull();
    expect(normalizeSiteUrl('')).toBeNull();
    expect(normalizeSiteUrl('/dental-scope/')).toBeNull();
    expect(normalizeSiteUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('page metadata', () => {
  it('describes the site as an educational reference, not a clinical tool', () => {
    expect(HOME.title).toMatch(/Dental Scope/);
    expect(HOME.description.length).toBeLessThanOrEqual(160);
    expect(HOME.description).toMatch(/educational/i);
    expect(`${HOME.title} ${HOME.description}`).not.toMatch(/diagnos(e|is|tic)|treatment|clinical/i);
  });
  it('builds a tooth page with all three notations', () => {
    const p = toothPage(36);
    expect(p.path).toBe('tooth/36/');
    expect(p.title).toBe('Mandibular left first molar (FDI 36 · Universal 19) — Dental Scope');
    expect(p.description).toContain('Palmer LL6');
    expect(p.description.length).toBeLessThanOrEqual(170);
  });
  it('keeps the tool name as the document title for every selection', () => {
    expect(documentTitle(undefined)).toBe(HOME.title);
    expect(documentTitle(registry.get('tooth-36'))).toBe('Dental Scope');
    expect(documentTitle(registry.get('enamel-36'))).toBe('Dental Scope');
    expect(documentTitle({ name: 'Inferior alveolar nerve' })).toBe('Dental Scope');
  });
});

describe('head tags', () => {
  it('adds canonical, Open Graph image and structured data only with an absolute site URL', () => {
    const withUrl = headTags(HOME, 'https://example.org/ds/');
    expect(withUrl).toContain('<link rel="canonical" href="https://example.org/ds/" />');
    expect(withUrl).toContain('<meta property="og:image" content="https://example.org/ds/og-image.png" />');
    expect(withUrl).toContain('"@type":"WebSite"');
    const without = headTags(HOME, null);
    expect(without).not.toContain('canonical');
    expect(without).not.toContain('og:image');
    expect(without).not.toContain('application/ld+json');
    expect(without).toContain('<meta property="og:title"');
  });
  it('marks the SPA fallback page noindex without a canonical URL', () => {
    const tags = headTags(HOME, 'https://example.org/', { notFound: true });
    expect(tags).toContain('<meta name="robots" content="noindex" />');
    expect(tags).not.toContain('canonical');
    expect(tags).not.toContain('og:url');
  });
  it('escapes text for HTML attributes', () => {
    expect(headTags({ path: '', title: 'A "B" <C>', description: 'x & y' }, null)).toContain('A &quot;B&quot; &lt;C&gt;');
  });
  it('points tooth pages at their own canonical URL', () => {
    expect(headTags(toothPage(11), 'https://example.org/')).toContain('href="https://example.org/tooth/11/"');
  });
});

describe('robots and sitemap', () => {
  it('allows crawling and links the sitemap when the site URL is known', () => {
    expect(robotsTxt('https://example.org/ds/')).toBe('User-agent: *\nAllow: /\n\nSitemap: https://example.org/ds/sitemap.xml\n');
    expect(robotsTxt(null)).toBe('User-agent: *\nAllow: /\n');
  });
  it('lists absolute page URLs', () => {
    const xml = sitemapXml('https://example.org/ds/', ['', 'tooth/11/']);
    expect(xml).toContain('<loc>https://example.org/ds/</loc>');
    expect(xml).toContain('<loc>https://example.org/ds/tooth/11/</loc>');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });
});

describe('structured data and the about page', () => {
  it('describes the home page as a free educational web app', () => {
    const tags = headTags(HOME, 'https://example.org/');
    expect(tags).toContain('"@type":"WebApplication"');
    expect(tags).toContain('"applicationCategory":"EducationalApplication"');
    expect(tags).toContain('"isAccessibleForFree":true');
  });
  it('gives tooth pages a breadcrumb and the tooth as an anatomical structure', () => {
    const data = JSON.stringify(structuredData(toothPage(36), 'https://example.org/'));
    expect(data).toContain('"@type":"BreadcrumbList"');
    expect(data).toContain('"alternateName":["FDI 36","Universal 19","Palmer LL6"]');
  });
  it('adds the Search Console token only when given', () => {
    expect(headTags(HOME, null, { googleVerification: 'abc' })).toContain('<meta name="google-site-verification" content="abc" />');
    expect(headTags(HOME, null)).not.toContain('google-site-verification');
  });
  it('writes a readable about page linking every tooth, with FAQ data', () => {
    const html = aboutHtml(headTags(ABOUT, 'https://example.org/'), '/', '/favicon.svg');
    for (const fdi of [11, 18, 21, 28, 31, 38, 41, 48]) expect(html).toContain(`href="/tooth/${fdi}/"`);
    expect(html).toContain('"@type":"FAQPage"');
    expect(html).toContain('<h1>');
    expect(html).not.toContain('undefined');
    expect(ABOUT.description.length).toBeLessThanOrEqual(160);
    expect(HOME.description.length).toBeLessThanOrEqual(160);
  });
});
