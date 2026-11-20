// Local check of the GitHub Pages demo: builds with DEMO=1 and base /website, then serves it on :4323.
import { execSync, spawn } from 'node:child_process';
const env = { ...process.env, DEMO: '1', BASE_PATH: '/website', SITE_URL: 'https://mechbridge.github.io', MSYS_NO_PATHCONV: '1' };
execSync('node scripts/build-demo.mjs', { stdio: 'inherit', env });
spawn('npx', ['astro', 'preview', '--port', '4323'], { stdio: 'inherit', env, shell: true });
