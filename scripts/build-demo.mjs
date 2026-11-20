// Static demo build (no server): data lives in the visitor's browser.
//   npm run build:demo                      → dist/ at the site root
//   BASE_PATH=/website SITE_URL=... node scripts/build-demo.mjs   → for GitHub Pages
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
execSync('npx astro build', { stdio: 'inherit', env: { ...process.env, DEMO: '1', MSYS_NO_PATHCONV: '1' } });
