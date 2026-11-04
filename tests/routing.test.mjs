import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = new URL('../', import.meta.url).pathname;
const wrangler = readFileSync(join(root, 'wrangler.toml'), 'utf8');

const redirectFiles = () => ['public/_redirects', 'dist/_redirects'].map((f) => join(root, f)).filter(existsSync);

test('no _redirects rule can loop (Cloudflare error 100324)', () => {
  for (const f of redirectFiles()) {
    const rules = readFileSync(f, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    for (const r of rules) {
      const [from, to] = r.split(/\s+/);
      const wildcard = from === '/*' || from.endsWith('*');
      assert.ok(!(wildcard && /^\/index(\.html)?$/.test(to)), `${f}: "${r}" rewrites to /index.html and matches it (infinite loop)`);
      assert.notEqual(from, to, `${f}: "${r}" redirects to itself`);
    }
  }
});

test('SPA fallback comes from the assets config, and /api/* runs the Worker first', () => {
  assert.match(wrangler, /not_found_handling\s*=\s*"single-page-application"/);
  assert.match(wrangler, /run_worker_first\s*=\s*\[[^\]]*"\/api\/\*"/);
});

test('static pages and entry points that must keep working exist in the build inputs', () => {
  for (const f of ['index.html', 'eureka-legacy.html', 'public/pages/ecosystem.html', 'public/pages/token.html', 'public/pages/tokenize.html', 'public/pages/my-assets.html']) {
    assert.ok(existsSync(join(root, f)), f);
  }
  assert.ok(statSync(join(root, 'public/whitepaper')).isDirectory() && readdirSync(join(root, 'public/whitepaper')).length > 0);
  assert.match(readFileSync(join(root, 'src/App.tsx'), 'utf8'), /path='\/control-center'/);
});

test('Worker routes /api/* before assets', () => {
  const w = readFileSync(join(root, 'cloudflare/worker.js'), 'utf8');
  assert.ok(w.indexOf('handleApi(') < w.indexOf('env.ASSETS.fetch'));
});

test('wrangler accepts the configuration (dry run, no deploy)', () => {
  execFileSync('npx', ['wrangler', 'deploy', '--dry-run', '--outdir', join(root, 'node_modules/.cache/dry')], { cwd: root, stdio: 'pipe' });
});
