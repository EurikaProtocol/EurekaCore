import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after, before } from 'node:test';
import { makeFakeGitHub, makeFakeTinan, makeIdentityProvider, migrate, startWorker } from './helpers/worker-harness.mjs';

/*
 * Inspects the GENERATED dist/ output. It never builds (no recursion): run `npm run build` first (see `npm run verify`).
 * If dist/ is missing the suite fails loudly instead of passing vacuously.
 */
const root = new URL('../', import.meta.url).pathname;
const p = (...s) => join(root, ...s);
const isDir = (f) => existsSync(f) && statSync(f).isDirectory();

test('precondition: dist/ is a real, freshly built Vite output', () => {
  assert.ok(isDir(p('dist')), 'dist/ missing: run `npm run build` before the routing tests');
  const html = readFileSync(p('dist/index.html'), 'utf8');
  assert.match(html, /<script[^>]+src="\/assets\/[^"]+\.js"/, 'dist/index.html must reference hashed built assets (not the source index.html)');
  assert.ok(isDir(p('dist/assets')) && readdirSync(p('dist/assets')).some((f) => f.endsWith('.js')), 'dist/assets must contain built JS');
});

test('build output contains every required page and directory', () => {
  for (const f of ['dist/index.html', 'dist/eureka-legacy.html', 'dist/pages/ecosystem.html', 'dist/pages/token.html', 'dist/pages/tokenize.html', 'dist/pages/my-assets.html']) {
    assert.ok(existsSync(p(f)) && statSync(p(f)).size > 0, `${f} missing or empty`);
  }
  assert.ok(isDir(p('dist/whitepaper')) && readdirSync(p('dist/whitepaper')).length > 0, 'dist/whitepaper must exist and contain files');
});

test('no _redirects file exists in source or build output', () => {
  assert.ok(isDir(p('public')) && isDir(p('dist')), 'both public/ and dist/ must be inspected');
  for (const f of ['public/_redirects', 'dist/_redirects']) assert.equal(existsSync(p(f)), false, `${f} must not exist (the "/* /index.html 200" rule loops, Cloudflare error 100324)`);
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  const stray = [...walk(p('public')), ...walk(p('dist'))].filter((f) => /(^|\/)_redirects$/.test(f));
  assert.deepEqual(stray, [], 'no _redirects file may exist anywhere in public/ or dist/');
});

test('wrangler.toml: SPA fallback, worker-first /api/*, assets from ./dist', () => {
  const t = readFileSync(p('wrangler.toml'), 'utf8').replace(/^\s*#.*$/gm, '');
  const assets = /\[assets\]([\s\S]*?)(?=\n\[|$)/.exec(t)?.[1];
  assert.ok(assets, '[assets] section missing');
  assert.match(assets, /^\s*directory\s*=\s*"\.\/dist"\s*$/m);
  assert.match(assets, /^\s*not_found_handling\s*=\s*"single-page-application"\s*$/m);
  const rwf = /^\s*run_worker_first\s*=\s*\[([^\]]*)\]/m.exec(assets)?.[1] ?? '';
  assert.ok(rwf.split(',').map((s) => s.trim().replace(/"/g, '')).includes('/api/*'), 'run_worker_first must include /api/*');
});

test('worker.js static ordering: handleApi runs before ASSETS.fetch (limitation: textual check only; behaviour is tested below)', () => {
  const w = readFileSync(p('cloudflare/worker.js'), 'utf8');
  assert.ok(w.indexOf('handleApi(') !== -1 && w.indexOf('handleApi(') < w.indexOf('env.ASSETS.fetch'));
});

let tpl;
let idp;
before(async () => { tpl = mkdtempSync(join(tmpdir(), 'eureka-route-')); migrate(tpl); idp = await makeIdentityProvider(); });
after(() => rmSync(tpl, { recursive: true, force: true }));

test('behaviour: the production Worker bundle answers /api/* itself and only falls through to assets for other paths', async () => {
  const w = await startWorker({ persist: tpl, idp, github: makeFakeGitHub(), tinan: makeFakeTinan(), sandboxRunner: { run: async () => { throw new Error('unused'); } } });
  try {
    for (const path of ['/api/session', '/api/products', '/api/workflows', '/api/does-not-exist']) {
      const r = await w.call('GET', path);
      assert.equal(r.status, 401, `${path} must be answered by the Worker (auth required), not an asset`);
      assert.ok(r.body && typeof r.body.error === 'string', `${path} must return a JSON error, not index.html`);
    }
    const ok = await w.call('GET', '/api/session', { token: await idp.sign('viewer@x.test') });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.email, 'viewer@x.test');
    // The ASSETS binding is stubbed in the harness; non-API paths must reach it unchanged.
    for (const path of ['/control-center', '/pages/token.html', '/whitepaper/', '/eureka-legacy.html', '/']) {
      const res = await w.mf.dispatchFetch(`https://eureka.test${path}`);
      assert.equal(res.status, 200, path);
      assert.equal(await res.text(), 'static asset stub', `${path} must be served by the assets fallback`);
    }
  } finally { await w.dispose(); }
});
