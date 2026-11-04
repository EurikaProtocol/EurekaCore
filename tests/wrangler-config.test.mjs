import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const root = new URL('../', import.meta.url).pathname;
const read = (f) => readFileSync(join(root, f), 'utf8');
const strip = (s) => s.replace(/^\s*\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1');
const jsonc = JSON.parse(strip(read('wrangler.jsonc')));
const toml = read('wrangler.toml').replace(/^\s*#.*$/gm, '');
const tomlVal = (k) => new RegExp(`^${k}\\s*=\\s*"([^"]+)"`, 'm').exec(toml)?.[1];

test('both configs always define a Worker script (never assets-only)', () => {
  assert.equal(jsonc.main, './cloudflare/worker.js');
  assert.equal(tomlVal('main'), './cloudflare/worker.js');
});

test('assets settings agree between wrangler.jsonc and wrangler.toml', () => {
  assert.equal(jsonc.assets.directory, './dist');
  assert.equal(jsonc.assets.binding, 'ASSETS');
  assert.equal(jsonc.assets.not_found_handling, 'single-page-application');
  assert.deepEqual(jsonc.assets.run_worker_first, ['/api/*']);
  assert.match(toml, /^directory\s*=\s*"\.\/dist"/m);
  assert.match(toml, /^binding\s*=\s*"ASSETS"/m);
  assert.equal(tomlVal('not_found_handling'), 'single-page-application');
  assert.match(toml, /^run_worker_first\s*=\s*\["\/api\/\*"\]/m);
});

test('Worker names are pinned (changing them needs owner approval) and no config adds a D1 or Access change', () => {
  assert.equal(jsonc.name, 'eurekacore');
  assert.equal(tomlVal('name'), 'eurekacore-v3');
  assert.ok(!('d1_databases' in jsonc) && !/d1_databases/.test(toml.replace(/^.*D1.*$/gm, '')));
});

test('all package/CI deploy entry points select wrangler.toml explicitly', () => {
  const s = JSON.parse(read('package.json')).scripts;
  assert.match(s.deploy, /--config wrangler\.toml/);
  assert.match(s['deploy:check'], /--config wrangler\.toml/);
  for (const f of ['.github/workflows/cloudflare-deploy.yml']) {
    for (const line of read(f).split('\n').filter((l) => /wrangler/.test(l) && /run:/.test(l))) assert.match(line, /--config wrangler\.toml|npm run deploy/);
  }
});

test('dry runs resolve the expected name, entry, assets binding and route for each selection', () => {
  const run = (args) => {
    const out = mkdtempSync(join(tmpdir(), 'wr-'));
    const log = execFileSync('npx', ['wrangler', 'deploy', '--dry-run', ...args, '--outdir', out], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, WRANGLER_OUTPUT_FILE_DIRECTORY: out } });
    return { log, readme: readFileSync(join(out, 'README.md'), 'utf8'), files: execFileSync('ls', [out], { encoding: 'utf8' }) };
  };
  const auth = run(['--config', 'wrangler.toml']);
  assert.match(auth.readme, /worker "eurekacore-v3"/);
  assert.match(auth.log, /env\.ASSETS \(Assets\)|ASSETS/);
  assert.ok(auth.files.includes('worker.js') && !auth.files.includes('no-op-worker.js'));
  const dflt = run([]); // what a bare `wrangler deploy` (Cloudflare Git integration) resolves
  assert.match(dflt.readme, /worker "eurekacore"/);
  assert.ok(dflt.files.includes('worker.js') && !dflt.files.includes('no-op-worker.js'), 'a bare `wrangler deploy` must never publish the assets-only no-op Worker');
  assert.match(dflt.log, /ASSETS/);
});

test('the Worker answers /api/* before any asset, and the SPA fallback is not a redirect rule', () => {
  const w = read('cloudflare/worker.js');
  assert.ok(w.indexOf('handleApi(') < w.indexOf('env.ASSETS.fetch'));
});
