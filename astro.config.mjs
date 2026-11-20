import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';

// Two builds from one codebase:
//   npm run build          → VPS production: Node server (pages prerendered + /api on demand), SQLite data.
//   DEMO=1 npm run build   → static demo for GitHub Pages: no server, data in the visitor's browser.
// Preview builds also set SITE_URL and BASE_PATH (see scripts/deploy-pages.mjs).
const DEMO = process.env.DEMO === '1';
const BASE = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');

// Mounts the API only on the production build, so the static demo has no on-demand routes.
const api = {
  name: 'mechbridge-api',
  hooks: {
    'astro:config:setup': ({ injectRoute }) => {
      if (!DEMO) injectRoute({ pattern: '/api/[...path]', entrypoint: './src/server/api.ts', prerender: false });
    },
  },
};

export default defineConfig({
  site: process.env.SITE_URL || 'https://mechbridgegroup.com',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'ignore',
  output: 'static',
  adapter: DEMO ? undefined : node({ mode: 'standalone' }),
  integrations: [
    api,
    sitemap({
      // Public pages only. Priorities follow the site hierarchy: home, services, then the rest.
      filter: (page) => !/\/(admin|404)(\/|$)/.test(page),
      changefreq: 'monthly',
      lastmod: new Date(),
      serialize(item) {
        const p = new URL(item.url).pathname.replace(BASE, '/').replace(/\/+$/, '') || '/';
        if (p === '/') return { ...item, priority: 1.0, changefreq: 'weekly' };
        if (p === '/services' || p.startsWith('/services/')) return { ...item, priority: 0.9 };
        if (['/training', '/careers', '/internships'].includes(p)) return { ...item, priority: 0.8, changefreq: 'weekly' };
        if (p === '/verify') return { ...item, priority: 0.4, changefreq: 'yearly' };
        return { ...item, priority: 0.6 };
      },
    }),
  ],
  server: { port: 4321, host: true },
  vite: {
    define: { 'import.meta.env.PUBLIC_DEMO': JSON.stringify(DEMO ? '1' : '') },
    ssr: { external: ['node:sqlite'] },
  },
  // The API does its own Origin-vs-Host check (src/server/api.ts); Astro's check misfires behind a proxy.
  security: { checkOrigin: false },
});
