// Builds the static demo (DEMO=1: no server, data in the browser) for GitHub Pages
// and pushes it to the gh-pages branch.
//   npm run deploy:pages
// The preview lives at https://mechbridge.github.io/website/ (base path /website).
import { execSync } from 'node:child_process';
import { rmSync, existsSync } from 'node:fs';

const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });
const remote = execSync('git remote get-url origin').toString().trim();
const sha = execSync('git rev-parse --short HEAD').toString().trim();

run('node scripts/build-demo.mjs', {
  env: { ...process.env, SITE_URL: 'https://mechbridge.github.io', BASE_PATH: '/website', MSYS_NO_PATHCONV: '1' },
});

if (existsSync('dist/.git')) rmSync('dist/.git', { recursive: true, force: true });
const git = (cmd) => run(`git ${cmd}`, { cwd: 'dist' });
git('init -q -b gh-pages');
git('add -A');
const who = (k) => execSync(`git config ${k}`).toString().trim();
git(`-c user.name="${who('user.name')}" -c user.email="${who('user.email')}" commit -q -m "Preview build from ${sha}"`);
git(`push -f ${remote} gh-pages`);
rmSync('dist/.git', { recursive: true, force: true });
console.log('\nPushed. GitHub Pages updates in about a minute: https://mechbridge.github.io/website/');
