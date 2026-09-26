/**
 * Search and sharing metadata. Pure functions shared by the build (vite.config.ts
 * writes the head tags, robots.txt, sitemap.xml and one static entry page per
 * tooth) and the app (document title while navigating).
 */
import { PERMANENT_FDI, fdiToPalmer, fdiToUniversal, toothName } from '../anatomy/notation.ts';
import type { Structure } from '../anatomy/types.ts';

export const SITE_NAME = 'Dental Scope';
export const AUTHOR = 'Yoseph';
export const REPOSITORY = 'https://github.com/Yoosseph/dental-scope';

export interface PageMeta {
  /** path below the site root, '' for home; tooth pages end with '/' (GitHub Pages serves folder/index.html) */
  path: string;
  title: string;
  description: string;
}

export const HOME: PageMeta = {
  path: '',
  title: SITE_NAME,
  description:
    'Free interactive 3D dental anatomy: all 32 permanent teeth with FDI, Universal and Palmer numbers, enamel to root canals, jaws and nerves. Educational tool.',
};

export const ABOUT: PageMeta = {
  path: 'about/',
  title: `About ${SITE_NAME}: Free Interactive 3D Dental Anatomy Atlas`,
  description:
    'A free, open-source 3D tooth atlas for dental students: every permanent tooth, tooth numbering systems, tooth tissues, jaws, nerves and muscles, explained.',
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

export interface HeadOptions {
  /** SPA fallback page: noindex, no canonical URL */
  notFound?: boolean;
  /** Google Search Console verification token (content of the google-site-verification meta tag) */
  googleVerification?: string | null;
}

/** JSON for a <script type="application/ld+json">, safe inside HTML. */
export const jsonLd = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

/** schema.org structured data for a page (a single @graph). */
export function structuredData(page: PageMeta, siteUrl: string): unknown {
  const url = siteUrl + page.path;
  const website = { '@id': `${siteUrl}#website` };
  const person = { '@type': 'Person', '@id': `${siteUrl}#author`, name: AUTHOR, url: 'https://github.com/Yoosseph' };
  const graph: unknown[] = [];
  if (page.path === '') {
    graph.push(
      {
        '@type': 'WebSite',
        ...website,
        name: SITE_NAME,
        url: siteUrl,
        description: page.description,
        inLanguage: 'en',
        publisher: { '@id': person['@id'] },
      },
      {
        '@type': 'WebApplication',
        '@id': `${siteUrl}#app`,
        name: SITE_NAME,
        url: siteUrl,
        description: page.description,
        applicationCategory: 'EducationalApplication',
        applicationSubCategory: 'Dental anatomy',
        operatingSystem: 'Any (modern web browser)',
        browserRequirements: 'Requires JavaScript and WebGL',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        image: siteUrl + OG_IMAGE.path,
        inLanguage: 'en',
        audience: { '@type': 'EducationalAudience', educationalRole: 'student', audienceType: 'Dental students, dental hygiene and assisting students, educators' },
        keywords: 'dental anatomy, tooth anatomy, 3D teeth, tooth numbering, FDI, Universal numbering, Palmer notation, root canals, dental education',
        author: { '@id': person['@id'] },
        sameAs: [REPOSITORY],
      },
      person,
    );
  } else {
    const crumbs: { name: string; url: string }[] = [{ name: SITE_NAME, url: siteUrl }];
    if (page.path.startsWith('tooth/')) crumbs.push({ name: 'Teeth', url: `${siteUrl}${ABOUT.path}#teeth` });
    crumbs.push({ name: page.path === ABOUT.path ? 'About' : page.title.replace(` — ${SITE_NAME}`, ''), url });
    const fdi = /^tooth\/(\d{2})\/$/.exec(page.path);
    graph.push({
      '@type': page.path === ABOUT.path ? 'AboutPage' : 'WebPage',
      '@id': url,
      url,
      name: page.title,
      description: page.description,
      inLanguage: 'en',
      isPartOf: website,
      primaryImageOfPage: siteUrl + OG_IMAGE.path,
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
      },
      ...(fdi
        ? {
            about: {
              '@type': 'AnatomicalStructure',
              name: toothName(Number(fdi[1])),
              alternateName: [`FDI ${fdi[1]}`, `Universal ${fdiToUniversal(Number(fdi[1]))}`, `Palmer ${fdiToPalmer(Number(fdi[1]))}`],
              bodyLocation: 'Mouth',
            },
          }
        : {}),
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

/**
 * `<head>` tags for one page. URL-based tags (canonical, og:url, og:image,
 * structured data) need an absolute site URL and are left out without one.
 */
export function headTags(page: PageMeta, siteUrl: string | null, opts: HeadOptions = {}): string {
  const tags = [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    `<meta name="author" content="${AUTHOR}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta name="twitter:title" content="${esc(page.title)}" />`,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
  ];
  if (opts.googleVerification) tags.push(`<meta name="google-site-verification" content="${esc(opts.googleVerification)}" />`);
  if (opts.notFound) {
    // SPA fallback for other deep links: served with HTTP 404, so keep it out of the index and don't claim a URL
    tags.push(`<meta name="robots" content="noindex" />`, `<meta name="twitter:card" content="summary" />`);
  } else if (siteUrl) {
    const url = siteUrl + page.path;
    tags.push(
      `<meta name="robots" content="index, follow, max-image-preview:large" />`,
      `<link rel="canonical" href="${esc(url)}" />`,
      `<meta property="og:url" content="${esc(url)}" />`,
      `<meta property="og:image" content="${esc(siteUrl + OG_IMAGE.path)}" />`,
      `<meta property="og:image:width" content="${OG_IMAGE.width}" />`,
      `<meta property="og:image:height" content="${OG_IMAGE.height}" />`,
      `<meta property="og:image:alt" content="${esc(OG_IMAGE.alt)}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:image" content="${esc(siteUrl + OG_IMAGE.path)}" />`,
      jsonLd(structuredData(page, siteUrl)),
    );
  } else {
    tags.push(`<meta name="twitter:card" content="summary" />`);
  }
  return tags.join('\n    ');
}

export function robotsTxt(siteUrl: string | null): string {
  return `User-agent: *\nAllow: /\n${siteUrl ? `\nSitemap: ${siteUrl}sitemap.xml\n` : ''}`;
}

export function sitemapXml(siteUrl: string, paths: string[], lastmod?: string): string {
  const mod = lastmod ? `<lastmod>${lastmod}</lastmod>` : '';
  const urls = paths.map((p) => `  <url><loc>${esc(siteUrl + p)}</loc>${mod}</url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
