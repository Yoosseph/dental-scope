/**
 * Search and sharing metadata. Pure functions shared by the build (vite.config.ts
 * writes the head tags, robots.txt, sitemap.xml and one static entry page per
 * tooth) and the app (document title while navigating).
 */
import { PERMANENT_FDI, fdiToPalmer, fdiToUniversal, toothName } from '../anatomy/notation';
import type { Structure } from '../anatomy/types';

export const SITE_NAME = 'Dental Scope';

export interface PageMeta {
  /** path below the site root, '' for home; tooth pages end with '/' (GitHub Pages serves folder/index.html) */
  path: string;
  title: string;
  description: string;
}

export const HOME: PageMeta = {
  path: '',
  title: 'Dental Scope — Interactive 3D Dental Anatomy',
  description:
    'Explore dental anatomy in 3D: all 32 permanent teeth, the jaws, gums and nerves, and the layers inside each tooth. A free, open-source educational reference.',
};

export const OG_IMAGE = { path: 'og-image.png', width: 1200, height: 630, alt: 'Dental Scope: 3D model of the jaws and permanent teeth' };

export function toothPage(fdi: number): PageMeta {
  const name = toothName(fdi);
  const numbers = `FDI ${fdi} · Universal ${fdiToUniversal(fdi)}`;
  return {
    path: `tooth/${fdi}/`,
    title: `${name} (${numbers}) — ${SITE_NAME}`,
    description: `Interactive 3D model of the ${name.toLowerCase()} (${numbers} · Palmer ${fdiToPalmer(fdi)}): crown, roots, pulp and canals. Educational reference.`,
  };
}

export const TOOTH_PAGES: PageMeta[] = PERMANENT_FDI.map(toothPage);

/** Title for the current selection (kept in sync by the router). */
export function documentTitle(sel: Pick<Structure, 'name' | 'tooth'> | undefined): string {
  if (!sel) return HOME.title;
  if (sel.tooth) return toothPage(sel.tooth.fdi).title;
  return `${sel.name} — ${SITE_NAME}`;
}

/** Absolute site root (with trailing slash), or null when not configured. */
export function normalizeSiteUrl(raw: string | undefined): string | null {
  const url = raw?.trim();
  if (!url || !/^https?:\/\/[^\s/]+/.test(url)) return null;
  return url.endsWith('/') ? url : `${url}/`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * `<head>` tags for one page. URL-based tags (canonical, og:url, og:image,
 * structured data) need an absolute site URL and are left out without one.
 */
export function headTags(page: PageMeta, siteUrl: string | null, opts: { notFound?: boolean } = {}): string {
  const tags = [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
  ];
  if (opts.notFound) {
    // SPA fallback for other deep links: served with HTTP 404, so keep it out of the index and don't claim a URL
    tags.push(`<meta name="robots" content="noindex" />`, `<meta name="twitter:card" content="summary" />`);
  } else if (siteUrl) {
    const url = siteUrl + page.path;
    tags.push(
      `<link rel="canonical" href="${esc(url)}" />`,
      `<meta property="og:url" content="${esc(url)}" />`,
      `<meta property="og:image" content="${esc(siteUrl + OG_IMAGE.path)}" />`,
      `<meta property="og:image:width" content="${OG_IMAGE.width}" />`,
      `<meta property="og:image:height" content="${OG_IMAGE.height}" />`,
      `<meta property="og:image:alt" content="${esc(OG_IMAGE.alt)}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
    );
    if (page.path === '') {
      const site = { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: siteUrl, description: page.description, inLanguage: 'en' };
      tags.push(`<script type="application/ld+json">${JSON.stringify(site).replace(/</g, '\\u003c')}</script>`);
    }
  } else {
    tags.push(`<meta name="twitter:card" content="summary" />`);
  }
  return tags.join('\n    ');
}

export function robotsTxt(siteUrl: string | null): string {
  return `User-agent: *\nAllow: /\n${siteUrl ? `\nSitemap: ${siteUrl}sitemap.xml\n` : ''}`;
}

export function sitemapXml(siteUrl: string, paths: string[]): string {
  const urls = paths.map((p) => `  <url><loc>${esc(siteUrl + p)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
