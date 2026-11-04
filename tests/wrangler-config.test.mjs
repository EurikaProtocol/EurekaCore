import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const root = new URL('../', import.meta.url).pathname;
const read = (f) => readFileSync(join(root, f), 'utf8');
const toml = read('wrangler.toml').replace(/^\s*#.*$/gm, '');
const tomlVal = (k) => new RegExp(`^${k}\\s*=\\s*"([^"]+)"`, 'm').exec(toml)?.[1];

test('wrangler.toml is the only deploy configuration', () => {
  for (const f of ['wrangler.jsonc', 'wrangler.json']) assert.ok(!existsSync(join(root, f)), `${f} must not exist`);
  assert.ok(existsSync(join(root, 'wrangler.toml')));
});

test('wrangler.toml defines the Worker script, ASSETS binding, SPA fallback and API-first routing', () => {
  assert.equal(tomlVal('main'), './cloudflare/worker.js');
  assert.equal(tomlVal('name'), 'eurekacore-v3'); // pinned until the live Worker identity is confirmed by the owner
  assert.match(toml, /^directory\s*=\s*"\.\/dist"/m);
  assert.match(toml, /^binding\s*=\s*"ASSETS"/m);
  assert.equal(tomlVal('not_found_handling'), 'single-page-application');
  assert.match(toml, /^run_worker_first\s*=\s*\["\/api\/\*"\]/m);
  assert.match(toml, /pattern\s*=\s*"www\.tinaneureka\.com"/);
});

test('no script, workflow or doc entry point references a second config or a bare wrangler deploy', () => {
  const s = JSON.parse(read('package.json')).scripts;
  for (const [k, v] of Object.entries(s)) {
    assert.ok(!/wrangler\.jsonc/.test(v), `script ${k}`);
    if (/wrangler (deploy|versions)/.test(v)) assert.match(v, /--config wrangler\.toml/, `script ${k}`);
  }
  assert.match(s.deploy, /wrangler deploy --config wrangler\.toml/);
  assert.match(s['deploy:check'], /--dry-run --config wrangler\.toml/);
  for (const line of read('.github/workflows/cloudflare-deploy.yml').split('\n').filter((l) => /wrangler/.test(l) && /run:/.test(l))) {
    assert.match(line, /--config wrangler\.toml/);
  }
  assert.ok(!/wrangler\.jsonc/.test(read('wrangler.toml').replace(/^\s*#.*$/gm, '')));
});

test('dry run with wrangler.toml and a bare dry run both publish the full Worker, never an assets-only one', () => {
  const run = (args) => {
    const out = mkdtempSync(join(tmpdir(), 'wr-'));
    const log = execFileSync('npx', ['wrangler', 'deploy', '--dry-run', ...args, '--outdir', out], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { log, readme: readFileSync(join(out, 'README.md'), 'utf8'), files: readdirSync(out) };
  };
  for (const args of [['--config', 'wrangler.toml'], []]) {
    const r = run(args);
    assert.match(r.readme, /worker "eurekacore-v3"/);
    assert.match(r.log, /env\.ASSETS/);
    assert.ok(r.files.includes('worker.js') && !r.files.includes('no-op-worker.js'));
  }
});

test('the Worker answers /api/* before any asset', () => {
  const w = read('cloudflare/worker.js');
  assert.ok(w.indexOf('handleApi(') < w.indexOf('env.ASSETS.fetch'));
});
