import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { HOME, TOOTH_PAGES, headTags, normalizeSiteUrl, robotsTxt, sitemapXml } from './src/app/seo';

const base = process.env.DS_BASE ?? '/';
/** Absolute public URL of the deployed site (e.g. https://user.github.io/dental-scope/); enables canonical URLs and the sitemap. */
const siteUrl = normalizeSiteUrl(process.env.DS_SITE_URL);
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
      return html.replace(SEO_MARKER, () => headTags(HOME, siteUrl));
    },
    closeBundle() {
      const index = readFileSync(`${outDir}/index.html`, 'utf8');
      const homeTags = headTags(HOME, siteUrl);
      if (!index.includes(homeTags)) throw new Error('seo: built index.html no longer contains the generated head tags');
      const withTags = (tags: string) => index.replace(homeTags, () => tags);
      writeFileSync(`${outDir}/404.html`, withTags(headTags(HOME, siteUrl, { notFound: true })));
      writeFileSync(`${outDir}/robots.txt`, robotsTxt(siteUrl));
      // with a relative base (hash routing) sub-folder pages would break asset paths
      const pages = base.startsWith('.') ? [] : TOOTH_PAGES;
      for (const page of pages) {
        mkdirSync(`${outDir}/${page.path}`, { recursive: true });
        writeFileSync(`${outDir}/${page.path}index.html`, withTags(headTags(page, siteUrl)));
      }
      if (siteUrl) writeFileSync(`${outDir}/sitemap.xml`, sitemapXml(siteUrl, [HOME.path, ...pages.map((p) => p.path)]));
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
