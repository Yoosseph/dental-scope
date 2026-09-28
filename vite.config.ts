import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { ABOUT_PAGES, HOME, TOOTH_PAGES, headTags, normalizeSiteUrl, robotsTxt, sitemapXml } from './src/app/seo.ts';
import { aboutHtml } from './src/app/about.ts';
import { GUIDE_PAGES, guideHtml } from './src/app/guide.ts';

const base = process.env.DS_BASE ?? '/';
/** Absolute public URL of the deployed site (e.g. https://user.github.io/dental-scope/); enables canonical URLs and the sitemap. */
// On Vercel it defaults to the project's production domain (a custom domain once one is added).
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const siteUrl = normalizeSiteUrl(process.env.DS_SITE_URL || (vercelUrl ? `https://${vercelUrl}` : undefined));
/** Google Search Console HTML-tag verification token (optional). */
const googleVerification = process.env.DS_GOOGLE_SITE_VERIFICATION?.trim() || null;
/** Vercel preview deployments (and any build with DS_PREVIEW=1) are kept out of search engines. */
const preview = process.env.DS_PREVIEW === '1' || (!!process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production');
const seoOpts = { googleVerification, noindex: preview };
const SEO_MARKER = /<!-- seo:[^>]*-->/;

/**
 * Search/sharing metadata: head tags in index.html, robots.txt, sitemap.xml, a
 * static entry page per tooth (`tooth/36/index.html`) so those deep links answer
 * with HTTP 200 and their own title, and a noindex 404.html app shell that static
 * hosts (GitHub Pages) serve for every other deep link.
 */
function seo(): Plugin {
  let outDir = 'dist';
  return {
    name: 'dental-scope-seo',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    transformIndexHtml(html) {
      if (!SEO_MARKER.test(html)) throw new Error('index.html is missing the <!-- seo: … --> marker');
      return html.replace(SEO_MARKER, () => headTags(HOME, siteUrl, seoOpts));
    },
    closeBundle() {
      const index = readFileSync(`${outDir}/index.html`, 'utf8');
      const homeTags = headTags(HOME, siteUrl, seoOpts);
      if (!index.includes(homeTags)) throw new Error('seo: built index.html no longer contains the generated head tags');
      const withTags = (tags: string) => index.replace(homeTags, () => tags);
      writeFileSync(`${outDir}/404.html`, withTags(headTags(HOME, siteUrl, { ...seoOpts, notFound: true })));
      writeFileSync(`${outDir}/robots.txt`, robotsTxt(siteUrl, preview));
      // with a relative base (hash routing) sub-folder pages would break asset paths
      const pages = base.startsWith('.') ? [] : TOOTH_PAGES;
      const guides = base.startsWith('.') ? [] : GUIDE_PAGES;
      // an explorer entry page steps out of the index once the tooth's English guide page is indexable (no two pages competing)
      const guided = new Set(guides.filter((g) => g.lang === 'en' && g.indexable && g.subject.fdi !== undefined).map((g) => `tooth/${g.subject.fdi}/`));
      for (const page of pages) {
        mkdirSync(`${outDir}/${page.path}`, { recursive: true });
        writeFileSync(`${outDir}/${page.path}index.html`, withTags(headTags(page, siteUrl, { ...seoOpts, noindex: preview || guided.has(page.path) })));
      }
      // text-first guide page per tooth and structure, in every language
      for (const page of guides) {
        mkdirSync(`${outDir}/${page.path}`, { recursive: true });
        writeFileSync(`${outDir}/${page.path}index.html`, guideHtml(page, headTags(page, siteUrl, { ...seoOpts, noindex: preview || !page.indexable }), base));
      }
      // plain-HTML about page with the readable guide to every tooth (no app bundle), in every interface language
      for (const page of ABOUT_PAGES) {
        // with a relative base, links climb out of about/ (and about/<lang>/)
        const absBase = base.startsWith('.') ? '../'.repeat(page.path.split('/').filter(Boolean).length) : base;
        mkdirSync(`${outDir}/${page.path}`, { recursive: true });
        writeFileSync(`${outDir}/${page.path}index.html`, aboutHtml(headTags(page, siteUrl, seoOpts), absBase, `${absBase}favicon.svg`, page.lang));
      }
      const today = new Date().toISOString().slice(0, 10);
      if (siteUrl && !preview)
        writeFileSync(
          `${outDir}/sitemap.xml`,
          sitemapXml(
            siteUrl,
            [
              HOME.path,
              ...ABOUT_PAGES.map((p) => ({ path: p.path, alternates: p.alternates })),
              ...pages.filter((p) => !guided.has(p.path)).map((p) => p.path),
              ...guides.filter((g) => g.indexable).map((g) => ({ path: g.path, alternates: g.alternates })),
            ],
            today,
          ),
        );
    },
  };
}

export default defineConfig({
  plugins: [react(), seo()],
  base,
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/react')) return 'react';
          return undefined;
        },
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
