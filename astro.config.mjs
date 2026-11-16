import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Production: https://mechbridgegroup.com at the root.
// Preview builds (GitHub Pages) set SITE_URL and BASE_PATH, e.g.
//   SITE_URL=https://mechbridge.github.io BASE_PATH=/website npm run build
export default defineConfig({
  site: process.env.SITE_URL || 'https://mechbridgegroup.com',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  server: { port: 4321 },
});
