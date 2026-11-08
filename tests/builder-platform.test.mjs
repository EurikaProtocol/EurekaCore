import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { crc32 } from 'node:zlib';
import test, { before } from 'node:test';
import { loadSource } from './helpers/load-src.mjs';
import { openD1Shim } from './helpers/d1-shim.mjs';
import { makeIdentityProvider, TEAM, AUD, ORIGIN } from './helpers/worker-harness.mjs';

/*
 * Native TINAN AI Builder workspace: real handleApi + real TinanAiBuilderProvider + real SQL (node:sqlite D1 shim) with
 * a contract-level fake of TINAN AI's routes (Builder Contract v1.1). NOT a live TINAN AI instance.
 */
const api = await loadSource('src/server/api.ts');
const bsvc = await loadSource('src/server/builder-service.ts');
const prov = await loadSource('src/server/tinanai-builder.ts');
const zipmod = await loadSource('src/core/zip.ts');

const sha = (s) => '0x' + createHash('sha256').update(s).digest('hex');
const PLAN = { summary: 'A tiny sum utility', technology: ['node'], features: ['sum'], steps: ['write sum.mjs', 'write sum.test.mjs'] };
const planDigestOf = (p) => sha(JSON.stringify(['eureka.builder-plan.v1', p.summary, p.technology, p.features, p.steps]));
const FILES = { 'sum.mjs': 'export const sum = (a, b) => a + b;\n', 'sum.test.mjs': "import test from 'node:test';\ntest('x', () => {});\n", 'README.md': '# Sum ünïcode\n' };
const manifestDigestOf = (pd, files) => sha(JSON.stringify(['eureka.builder-manifest.v1', pd, [...files].sort((a, b) => (a.path < b.path ? -1 : 1)).map((f) => [f.path, f.bytes, f.sha256])]));
const SVC_OWNER = createHash('sha256').update('svc').digest('hex');
const DELEG_SECRET = 'd'.repeat(40);
const delegatedOwner = (sub) => createHash('sha256').update(`tinan-delegated-owner:v1:${sub}`).digest('hex');

function verifyDelegation(token) {
  const [v, payload, sig] = token.split('.');
  const expected = createHmac('sha256', DELEG_SECRET).update(`${v}.${payload}`).digest('hex');
  if (v !== 'v1' || sig !== expected) return null;
  const c = JSON.parse(Buffer.from(payload, 'base64url').toString());
  const now = Math.floor(Date.now() / 1000);
  if (c.aud !== 'tinan-ai' || now > c.exp || c.exp - c.iat > 300) return null;
  return c.sub;
}

/** Contract-level TINAN AI stand-in with many tasks. `mode` knobs inject failures. */
function fakeTinan(mode = {}) {
  const st = { tasks: new Map(), calls: [], headers: [], mode, files: { ...FILES }, approvalBodies: [], cancels: 0 };
  const j = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
  st.handle = async (req) => {
    const u = new URL(req.url);
    st.calls.push(`${req.method} ${u.pathname}`);
    st.headers.push(Object.fromEntries(req.headers));
    if (st.mode.down) return j({ error: 'down' }, 503);
    if (st.mode.networkError) throw new TypeError('network');
    if (st.mode.flaky?.n > 0) { st.mode.flaky.n--; return j({ error: 'flaky' }, 503); }
    if (st.mode.authFail || !req.headers.get('authorization')?.startsWith('Basic ')) return j({ error: 'auth' }, 401);
    if (req.method !== 'GET' && req.headers.get('origin') !== 'https://tinan.test') return j({ error: 'origin' }, 403);
    let owner = SVC_OWNER;
    const deleg = req.headers.get('x-eureka-delegation');
    if (st.mode.delegated) {
      const sub = deleg ? verifyDelegation(deleg) : null;
      if (!sub) return j({ error: 'bad delegation', code: 'INVALID_DELEGATION' }, 401);
      owner = delegatedOwner(sub);
    } else if (deleg) return j({ error: 'disabled', code: 'MULTI_USER_DISABLED' }, 403);
    const p = u.pathname;
    const rec = (id) => { const t = st.tasks.get(id); return t && t.owner === owner ? t : null; };
    const view = (t) => ({ id: t.id, ownerId: t.owner, kind: 'project', projectId: t.status === 'completed' ? t.projectId : null, requirements: t.requirements, plan: t.status === 'planning' ? null : (st.mode.plan ?? PLAN), status: t.status, errors: t.errors ?? [] });
    let m;
    if (req.method === 'POST' && p === '/api/projects') {
      const b = await req.json();
      const t = { id: randomUUID(), projectId: randomUUID(), owner, requirements: b.requirements, status: 'planning' };
      st.tasks.set(t.id, t);
      return j({ task: view(t) }, 202);
    }
    if (req.method === 'GET' && (m = /^\/api\/projects\/tasks\/([0-9a-f-]{36})$/.exec(p))) {
      const t = rec(m[1]);
      if (!t) return j({ error: 'nf' }, 404);
      if (t.status === 'planning') t.status = st.mode.providerFails ? 'failed' : 'awaiting_approval';
      if (t.status === 'failed') t.errors = ['AI provider error: upstream model unavailable'];
      else if (t.status === 'generating') t.status = 'completed';
      if (st.mode.bypass && t.status === 'awaiting_approval') t.status = 'generating';
      return j({ task: view(t) });
    }
    if (req.method === 'POST' && (m = /^\/api\/projects\/tasks\/([0-9a-f-]{36})\/approval$/.exec(p))) {
      const t = rec(m[1]); const b = await req.json();
      if (!t) return j({ error: 'nf' }, 404);
      st.approvalBodies.push(b);
      if (t.status !== 'awaiting_approval' || b.approved !== true) return j({ error: 'state' }, 409);
      if (b.planDigest !== planDigestOf(st.mode.plan ?? PLAN)) return j({ error: 'mismatch', code: 'PLAN_DIGEST_MISMATCH' }, 409);
      t.status = 'generating';
      return j({ task: view(t) }, 202);
    }
    if (req.method === 'POST' && (m = /^\/api\/projects\/tasks\/([0-9a-f-]{36})\/cancel$/.exec(p))) {
      const t = rec(m[1]);
      if (!t) return j({ error: 'nf' }, 404);
      if (st.mode.cancelFails) return j({ error: 'down' }, 503);
      st.cancels++; t.status = 'cancelled';
      return j({ task: view(t) });
    }
    if (req.method === 'GET' && (m = /^\/api\/projects\/tasks\/([0-9a-f-]{36})\/manifest$/.exec(p))) {
      const t = rec(m[1]);
      if (!t) return j({ error: 'nf' }, 404);
      if (st.mode.noManifest) return j({ error: 'nf' }, 404);
      if (t.status !== 'completed') return j({ error: 'nc' }, 409);
      const files = Object.entries(FILES).map(([path, c]) => ({ path, bytes: Buffer.byteLength(c), sha256: sha(c) }));
      const pd = st.mode.manifestPlanDigest ?? planDigestOf(st.mode.plan ?? PLAN);
      const md = st.mode.badManifestDigest ? sha('x') : manifestDigestOf(pd, files);
      return j({ manifest: { contractVersion: st.mode.contractVersion ?? '1.1', taskId: t.id, projectId: t.projectId, ownerId: owner, planDigest: pd, files, totalBytes: files.reduce((n, f) => n + f.bytes, 0), manifestDigest: md } });
    }
    if (req.method === 'GET' && (m = /^\/api\/projects\/([0-9a-f-]{36})$/.exec(p))) {
      const t = [...st.tasks.values()].find((x) => x.projectId === m[1] && x.owner === owner);
      return t ? j({ project: { id: t.projectId, ownerId: owner, files: Object.keys(st.files) } }) : j({ error: 'nf' }, 404);
    }
    if (req.method === 'GET' && (m = /^\/api\/projects\/([0-9a-f-]{36})\/files$/.exec(p))) {
      const t = [...st.tasks.values()].find((x) => x.projectId === m[1] && x.owner === owner);
      const path = u.searchParams.get('path');
      return t && typeof st.files[path] === 'string' ? j({ path, content: st.files[path] }) : j({ error: 'nf' }, 404);
    }
    return j({ error: 'not found' }, 404);
  };
  return st;
}

let idp;
before(async () => { idp = await makeIdentityProvider(); });

const ALL = Array.from({ length: 12 }, (_, i) => `u${i}@x.test`);
function boot({ tinan = fakeTinan(), env = {}, db = openD1Shim() } = {}) {
  const fullEnv = {
    ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, DB: db,
    EUREKA_VIEWERS: 'viewer@x.test', EUREKA_OPERATORS: `op@x.test,${ALL.join(',')}`, EUREKA_APPROVERS: `ap@x.test,${ALL.join(',')}`,
    TINANAI_BASE_URL: 'https://tinan.test', TINANAI_USERNAME: 'svc', TINANAI_PASSWORD: 'p'.repeat(40), TINANAI_BUILDER_ENABLED: 'true', ...env,
  };
  const fetchImpl = async (input, init) => {
    const req = new Request(input, init);
    const u = new URL(req.url);
    if (u.hostname === TEAM) return new Response(JSON.stringify(idp.jwks), { headers: { 'content-type': 'application/json' } });
    if (u.hostname === 'tinan.test') return tinan.handle(req);
    return new Response('blocked', { status: 502 });
  };
  // A fake clock that advances 61 s per request keeps the per-identity write limiter out of the way; one test uses the real clock.
  let clock = Date.now();
  const call = async (method, path, { as, body, headers = {}, raw = false, realClock = false } = {}) => {
    const token = as ? await idp.sign(as, { exp: Math.floor(Date.now() / 1000) + 10 * 365 * 86400 }) : undefined;
    const res = await api.handleApi(new Request(`${ORIGIN}${path}`, {
      method,
      headers: { ...(token ? { 'Cf-Access-Jwt-Assertion': token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { Origin: ORIGIN } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    }), fullEnv, { fetch: fetchImpl, now: realClock ? undefined : () => (clock += 61_000) });
    if (raw) return res;
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  return { call, tinan, db, env: fullEnv };
}

const REQ = { name: 'Sum utility', requirements: 'Build a tiny sum utility with tests' };
const create = (w, as = 'u0@x.test') => w.call('POST', '/api/builder/projects', { as, body: REQ });
const get = (w, id, as = 'u0@x.test') => w.call('GET', `/api/builder/projects/${id}`, { as });

async function toAwaiting(w, as = 'u0@x.test') {
  const c = await create(w, as);
  assert.equal(c.status, 201);
  const g = await get(w, c.body.project.id, as);
  assert.equal(g.body.project.status, 'awaiting_approval');
  return g.body.project;
}
async function toCompleted(w, as = 'u0@x.test') {
  const p = await toAwaiting(w, as);
  const a = await w.call('POST', `/api/builder/projects/${p.id}/approve`, { as, body: { planDigest: p.planDigest } });
  assert.equal(a.status, 200);
  const g = await get(w, p.id, as);
  return g.body.project;
}

test('migration 0003 creates builder_projects with the owner index', () => {
  const db = openD1Shim();
  const cols = db.raw.prepare("SELECT name FROM pragma_table_info('builder_projects')").all().map((r) => r.name);
  assert.deepEqual(cols.sort(), ['id', 'owner_email', 'record_json', 'status', 'updated_at', 'version']);
  assert.ok(db.raw.prepare("SELECT 1 FROM pragma_index_list('builder_projects') WHERE name='builder_projects_owner'").get());
});

test('connectivity: connected, authentication failed, unavailable and not configured are reported truthfully', async () => {
  const w = boot();
  const ok = await w.call('GET', '/api/builder/status', { as: 'viewer@x.test' });
  assert.equal(ok.body.integration.state, 'connected');
  assert.equal(ok.body.integration.contractVersion, '1.1');
  assert.equal(ok.body.integration.authMode, 'single-owner');
  assert.equal((await boot({ tinan: fakeTinan({ authFail: true }) }).call('GET', '/api/builder/status', { as: 'viewer@x.test' })).body.integration.state, 'authentication_failed');
  assert.equal((await boot({ tinan: fakeTinan({ down: true }) }).call('GET', '/api/builder/status', { as: 'viewer@x.test' })).body.integration.state, 'unavailable');
  assert.equal((await boot({ tinan: fakeTinan({ networkError: true }) }).call('GET', '/api/builder/status', { as: 'viewer@x.test' })).body.integration.state, 'unavailable');
  assert.equal((await boot({ env: { TINANAI_BUILDER_ENABLED: 'false' } }).call('GET', '/api/builder/status', { as: 'viewer@x.test' })).body.integration.state, 'not_configured');
});

test('never falls back to mock generation when the Builder is not configured', async () => {
  const w = boot({ env: { TINANAI_BUILDER_ENABLED: undefined } });
  const r = await create(w);
  assert.equal(r.status, 503);
  assert.equal(r.body.code, 'BUILDER_NOT_CONFIGURED');
  assert.equal(w.tinan.calls.length, 0);
  assert.equal((await w.call('GET', '/api/builder/projects', { as: 'u0@x.test' })).body.projects.length, 0);
});

test('unauthorized access: no token, wrong role, forged identity and cross-origin writes are refused', async () => {
  const w = boot();
  assert.equal((await w.call('GET', '/api/builder/projects')).status, 401);
  assert.equal((await w.call('POST', '/api/builder/projects', { body: REQ })).status, 401);
  assert.equal((await create(w, 'stranger@x.test')).status, 403);
  assert.equal((await create(w, 'viewer@x.test')).status, 403);
  // Forged identity fields and headers are ignored: ownership comes from the verified token only.
  const forged = await w.call('POST', '/api/builder/projects', { as: 'u1@x.test', headers: { 'X-User': 'u2@x.test', 'Cf-Access-Authenticated-User-Email': 'u2@x.test' }, body: { ...REQ, ownerEmail: 'u2@x.test', owner: 'u2@x.test', userId: 'u2@x.test' } });
  assert.equal(forged.status, 201);
  assert.equal((await w.call('GET', '/api/builder/projects', { as: 'u2@x.test' })).body.projects.length, 0);
  assert.equal((await w.call('GET', '/api/builder/projects', { as: 'u1@x.test' })).body.projects.length, 1);
  assert.equal((await w.call('POST', '/api/builder/projects', { as: 'u1@x.test', body: REQ, headers: { Origin: 'https://evil.test' } })).status, 403);
  assert.equal((await w.call('POST', '/api/builder/projects', { as: 'u3@x.test', body: { name: '', requirements: 'x' } })).status, 400);
  assert.equal((await w.call('POST', '/api/builder/projects', { as: 'u3@x.test', body: { name: 'n', requirements: 'x'.repeat(4001) } })).status, 400);
  assert.equal((await w.call('GET', '/api/builder/projects/not-an-id', { as: 'u1@x.test' })).status, 404);
});

test('private project isolation: another verified user can read, change or export nothing', async () => {
  const w = boot();
  const mine = await toCompleted(w, 'u4@x.test');
  assert.equal(mine.status, 'completed');
  for (const [m, suffix, body] of [['GET', ''], ['GET', '/file?path=sum.mjs'], ['GET', '/export'], ['GET', '/history'], ['POST', '/approve', { planDigest: mine.planDigest }], ['POST', '/cancel', {}], ['POST', '/retry', {}]]) {
    const r = await w.call(m, `/api/builder/projects/${mine.id}${suffix}`, { as: 'u5@x.test', body });
    assert.equal(r.status, 404, `${m} ${suffix}`);
  }
  assert.equal((await w.call('GET', '/api/builder/projects', { as: 'u5@x.test' })).body.projects.length, 0);
  assert.equal((await w.call('GET', '/api/builder/history', { as: 'u5@x.test' })).body.history.length, 0);
  assert.equal((await get(w, mine.id, 'u4@x.test')).body.project.status, 'completed');
  // A foreign project id that does not exist answers identically (no existence oracle).
  assert.equal((await get(w, 'bp-' + randomUUID(), 'u5@x.test')).status, 404);
  // The record's stored owner is the verified email and is never serialised to clients.
  assert.equal(w.db.raw.prepare('SELECT owner_email FROM builder_projects WHERE id = ?').get(mine.id).owner_email, 'u4@x.test');
  assert.ok(!JSON.stringify((await get(w, mine.id, 'u4@x.test')).body).includes('ownerEmail'));
});

test('full flow: plan digest, explicit approval, manifest and SHA-256 verification, files, ZIP', async () => {
  const w = boot();
  const p = await toAwaiting(w);
  assert.equal(p.planDigest, planDigestOf(PLAN));
  assert.deepEqual(p.plan, PLAN);
  assert.equal(p.buildValidation, 'not-run');
  assert.equal(w.tinan.approvalBodies.length, 0, 'nothing is forwarded before a human approves');
  assert.ok(!w.tinan.calls.some((c) => c.endsWith('/manifest')));

  // Approval needs an approver, a digest of the displayed plan, and is forwarded with exactly that digest.
  assert.equal((await w.call('POST', `/api/builder/projects/${p.id}/approve`, { as: 'u1@x.test', body: { planDigest: p.planDigest } })).status, 404 /* approver, but not the owner */);
  assert.equal((await w.call('POST', `/api/builder/projects/${p.id}/approve`, { as: 'u0@x.test', body: {} })).status, 400);
  const wrong = await w.call('POST', `/api/builder/projects/${p.id}/approve`, { as: 'u0@x.test', body: { planDigest: sha('other plan') } });
  assert.equal(wrong.status, 409);
  assert.equal(wrong.body.code, 'PLAN_DIGEST_MISMATCH');
  assert.equal(w.tinan.approvalBodies.length, 0);
  const a = await w.call('POST', `/api/builder/projects/${p.id}/approve`, { as: 'u0@x.test', body: { planDigest: p.planDigest, approvedBy: 'someone-else@x.test' } });
  assert.equal(a.status, 200);
  assert.equal(a.body.project.approval.approvedBy, 'u0@x.test');
  assert.equal(a.body.project.approval.forwarded, true);
  assert.deepEqual(w.tinan.approvalBodies, [{ approved: true, planDigest: p.planDigest }]);
  assert.equal(a.body.project.status, 'generating');

  const done = (await get(w, p.id)).body.project;
  assert.equal(done.status, 'completed');
  assert.equal(done.validation.passed, true);
  assert.equal(done.validation.manifestDigestMatches && done.validation.fileSetMatches && done.validation.planDigestMatchesApproval, true);
  assert.deepEqual(done.manifest.files.map((f) => f.path).sort(), Object.keys(FILES).sort());
  for (const f of done.validation.files) assert.equal(f.ok, true);
  assert.equal(done.buildValidation, 'not-run');

  const file = await w.call('GET', `/api/builder/projects/${p.id}/file?path=README.md`, { as: 'u0@x.test' });
  assert.equal(file.body.file.content, FILES['README.md']);
  assert.equal(file.body.file.sha256, sha(FILES['README.md']));
  assert.equal((await w.call('GET', `/api/builder/projects/${p.id}/file?path=../secret`, { as: 'u0@x.test' })).status, 404);

  const z = await w.call('GET', `/api/builder/projects/${p.id}/export`, { as: 'u0@x.test', raw: true });
  assert.equal(z.status, 200);
  assert.equal(z.headers.get('content-type'), 'application/zip');
  assert.match(z.headers.get('content-disposition'), /attachment; filename="sum-utility-[0-9a-f]{8}\.zip"/);
  const entries = parseZip(Buffer.from(await z.arrayBuffer()));
  assert.deepEqual(Object.keys(entries).sort(), Object.keys(FILES).sort());
  for (const [name, content] of Object.entries(FILES)) assert.equal(entries[name], content);
});

/** Independent STORE-only zip reader that also validates CRC-32 and the central directory. */
function parseZip(buf) {
  const eocd = buf.length - 22;
  assert.equal(buf.readUInt32LE(eocd), 0x06054b50);
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50);
    const crc = buf.readUInt32LE(p + 16); const size = buf.readUInt32LE(p + 24); const nlen = buf.readUInt16LE(p + 28); const off = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nlen).toString();
    assert.equal(buf.readUInt32LE(off), 0x04034b50);
    const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    const data = buf.subarray(start, start + size);
    assert.equal(crc32(data), crc);
    out[name] = data.toString();
    p += 46 + nlen;
  }
  return out;
}

test('ZIP writer: CRC and layout are correct for empty and unicode content', () => {
  const bytes = zipmod.createZip([{ path: 'a/empty.txt', content: '' }, { path: 'ü.txt', content: 'héllo' }]);
  assert.deepEqual(parseZip(Buffer.from(bytes)), { 'a/empty.txt': '', 'ü.txt': 'héllo' });
  assert.equal(zipmod.crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('approval roles: an approver who is not an operator cannot create; an operator who is not an approver cannot approve', async () => {
  const w = boot({ env: { EUREKA_OPERATORS: 'op@x.test', EUREKA_APPROVERS: 'ap@x.test' } });
  assert.equal((await create(w, 'ap@x.test')).status, 403);
  const c = await create(w, 'op@x.test');
  const p = (await get(w, c.body.project.id, 'op@x.test')).body.project;
  const r = await w.call('POST', `/api/builder/projects/${p.id}/approve`, { as: 'op@x.test', body: { planDigest: p.planDigest } });
  assert.equal(r.status, 403);
  assert.equal(w.tinan.approvalBodies.length, 0);
});

test('manifest verification: digest, contract version, missing manifest and plan swap are all refused', async () => {
  for (const [mode, expect] of [
    [{ badManifestDigest: true }, /manifest digest/i],
    [{ contractVersion: '1.0' }, /invalid or mismatched manifest/i],
    [{ noManifest: true }, /did not provide a manifest/i],
  ]) {
    const w = boot({ tinan: fakeTinan(mode) });
    const p = await toCompleted(w);
    assert.equal(p.status, 'failed', JSON.stringify(mode));
    assert.match(p.errors.join(' '), expect);
    assert.equal(p.validation, null);
    assert.equal((await w.call('GET', `/api/builder/projects/${p.id}/export`, { as: 'u0@x.test' })).status, 409, 'unverified output cannot be exported');
  }
  // The manifest must be bound to the plan the human approved.
  const w = boot({ tinan: fakeTinan({ manifestPlanDigest: sha('a different plan') }) });
  const p = await toCompleted(w);
  assert.equal(p.status, 'failed');
  assert.equal(p.validation.planDigestMatchesApproval, false);
  assert.equal(p.validation.passed, false);
});

test('file hash verification: a file whose bytes differ from the manifest fails validation and is never served', async () => {
  const w = boot();
  const p = await toAwaiting(w);
  w.tinan.files['sum.mjs'] = 'export const sum = () => 42; // tampered\n';
  await w.call('POST', `/api/builder/projects/${p.id}/approve`, { as: 'u0@x.test', body: { planDigest: p.planDigest } });
  const done = (await get(w, p.id)).body.project;
  assert.equal(done.status, 'failed');
  assert.equal(done.validation.passed, false);
  assert.equal(done.validation.files.find((f) => f.path === 'sum.mjs').ok, false);
  assert.equal(done.validation.files.find((f) => f.path === 'README.md').ok, true);
  assert.equal((await w.call('GET', `/api/builder/projects/${p.id}/file?path=sum.mjs`, { as: 'u0@x.test' })).status, 409);
});

test('file set mismatch (extra upstream file) fails validation', async () => {
  const w = boot();
  const p = await toAwaiting(w);
  w.tinan.files['extra.js'] = 'x';
  await w.call('POST', `/api/builder/projects/${p.id}/approve`, { as: 'u0@x.test', body: { planDigest: p.planDigest } });
  const done = (await get(w, p.id)).body.project;
  assert.equal(done.status, 'failed');
  assert.equal(done.validation.fileSetMatches, false);
});

test('a file changed upstream after verification is refused at download and export time', async () => {
  const w = boot();
  const p = await toCompleted(w);
  assert.equal(p.status, 'completed');
  w.tinan.files['README.md'] = 'swapped';
  const f = await w.call('GET', `/api/builder/projects/${p.id}/file?path=README.md`, { as: 'u0@x.test' });
  assert.equal(f.status, 502);
  assert.equal(f.body.code, 'FILE_HASH_MISMATCH');
  const z = await w.call('GET', `/api/builder/projects/${p.id}/export`, { as: 'u0@x.test' });
  assert.equal(z.status, 502);
  assert.ok((await w.call('GET', '/api/builder/history', { as: 'u0@x.test' })).body.history.some((h) => h.action === 'builder.file.hash_mismatch'));
});

test('cancellation: forwarded to TINAN AI, recorded, and only reported when TINAN AI accepted it', async () => {
  const w = boot();
  const p = await toAwaiting(w);
  assert.equal((await w.call('POST', `/api/builder/projects/${p.id}/cancel`, { as: 'viewer@x.test', body: {} })).status, 403);
  const c = await w.call('POST', `/api/builder/projects/${p.id}/cancel`, { as: 'u0@x.test', body: {} });
  assert.equal(c.status, 200);
  assert.equal(c.body.project.status, 'cancelled');
  assert.equal(w.tinan.cancels, 1);
  assert.equal((await w.call('POST', `/api/builder/projects/${p.id}/cancel`, { as: 'u0@x.test', body: {} })).status, 409);
  assert.equal((await w.call('POST', `/api/builder/projects/${p.id}/approve`, { as: 'u0@x.test', body: { planDigest: p.planDigest } })).status, 409);

  const w2 = boot({ tinan: fakeTinan({ cancelFails: true }) });
  const p2 = await toAwaiting(w2);
  const bad = await w2.call('POST', `/api/builder/projects/${p2.id}/cancel`, { as: 'u0@x.test', body: {} });
  assert.equal(bad.status, 503);
  assert.equal((await get(w2, p2.id)).body.project.status, 'awaiting_approval', 'status is not faked when TINAN AI did not cancel');
});

test('failed AI provider: real failure shown, retry resubmits, needs a new approval, attempts are bounded', async () => {
  const w = boot({ tinan: fakeTinan({ providerFails: true }) });
  const c = await create(w);
  const failed = (await get(w, c.body.project.id)).body.project;
  assert.equal(failed.status, 'failed');
  assert.match(failed.errors[0], /AI provider error/);
  assert.equal(failed.manifest, null);
  assert.equal((await w.call('POST', `/api/builder/projects/${failed.id}/approve`, { as: 'u0@x.test', body: { planDigest: sha('x') } })).status, 409);
  const r2 = await w.call('POST', `/api/builder/projects/${failed.id}/retry`, { as: 'u0@x.test', body: {} });
  assert.equal(r2.status, 200);
  assert.equal(r2.body.project.attempt, 2);
  assert.equal(r2.body.project.approval, null);
  assert.equal((await get(w, failed.id)).body.project.status, 'failed');
  await w.call('POST', `/api/builder/projects/${failed.id}/retry`, { as: 'u0@x.test', body: {} });
  await get(w, failed.id);
  const limit = await w.call('POST', `/api/builder/projects/${failed.id}/retry`, { as: 'u0@x.test', body: {} });
  assert.equal(limit.status, 409);
  assert.equal(limit.body.code, 'RETRY_LIMIT');
  const final = (await get(w, failed.id)).body.project;
  assert.equal(final.attempts.length, 3);
  // Retry is only valid for failed or cancelled tasks.
  const w2 = boot();
  const p = await toAwaiting(w2);
  assert.equal((await w2.call('POST', `/api/builder/projects/${p.id}/retry`, { as: 'u0@x.test', body: {} })).status, 409);
});

test('a retried task after success-less cancel gets a fresh plan and cannot reuse the old approval', async () => {
  const w = boot();
  const p = await toAwaiting(w);
  await w.call('POST', `/api/builder/projects/${p.id}/cancel`, { as: 'u0@x.test', body: {} });
  const r = await w.call('POST', `/api/builder/projects/${p.id}/retry`, { as: 'u0@x.test', body: {} });
  assert.equal(r.body.project.status, 'planning');
  const again = (await get(w, p.id)).body.project;
  assert.equal(again.status, 'awaiting_approval');
  assert.equal(again.approval, null);
});

test('TINAN AI generating without a recorded EurekaCore approval is rejected and cancelled', async () => {
  const w = boot({ tinan: fakeTinan({ bypass: true }) });
  const c = await create(w);
  const p = (await get(w, c.body.project.id)).body.project;
  assert.equal(p.status, 'failed');
  assert.match(p.errors[0], /without an approval recorded by EurekaCore/);
  assert.equal(w.tinan.cancels, 1);
  assert.equal(p.manifest, null);
});

test('integration problems surface as real status without changing task state', async () => {
  const w = boot();
  const p = await toAwaiting(w);
  w.tinan.mode.authFail = true;
  const a = await get(w, p.id);
  assert.equal(a.body.project.status, 'awaiting_approval');
  assert.equal(a.body.integration.state, 'authentication_failed');
  w.tinan.mode.authFail = false; w.tinan.mode.down = true;
  assert.equal((await get(w, p.id)).body.integration.state, 'unavailable');
  const ap = await w.call('POST', `/api/builder/projects/${p.id}/approve`, { as: 'u0@x.test', body: { planDigest: p.planDigest } });
  assert.equal(ap.status, 503);
  assert.equal(ap.body.code, 'TINAN_UNAVAILABLE');
  w.tinan.mode.down = false;
  assert.equal((await get(w, p.id)).body.project.status, 'awaiting_approval');
  // Submission failure is recorded as a real failed state, not simulated.
  const w2 = boot({ tinan: fakeTinan({ down: true }) });
  const c = await create(w2);
  assert.equal(c.status, 201);
  assert.equal(c.body.project.status, 'failed');
  assert.match(c.body.project.errors[0], /unavailable/i);
});

test('lost TINAN AI task (restart) marks the task failed instead of guessing', async () => {
  const w = boot();
  const p = await toAwaiting(w);
  w.tinan.tasks.clear();
  const g = (await get(w, p.id)).body.project;
  assert.equal(g.status, 'failed');
  assert.match(g.errors[0], /no longer has this task/);
});

test('timeouts and bounded retries: transient GET failures are retried at most twice; POSTs are never retried', async () => {
  const w = boot();
  const c = await create(w);
  w.tinan.mode.flaky = { n: 2 };
  assert.equal((await get(w, c.body.project.id)).body.project.status, 'awaiting_approval');
  const w2 = boot();
  const c2 = await create(w2);
  const before = w2.tinan.calls.length;
  w2.tinan.mode.down = true;
  const r = await get(w2, c2.body.project.id);
  assert.equal(r.body.integration.state, 'unavailable');
  assert.equal(w2.tinan.calls.length - before, 3, '1 attempt + 2 retries');
  const w3 = boot({ tinan: fakeTinan({ down: true }) });
  await create(w3);
  assert.equal(w3.tinan.calls.filter((x) => x.startsWith('POST')).length, 1);
  // A hanging upstream is aborted by the request timeout.
  const provider = new prov.TinanAiBuilderProvider({ baseUrl: 'https://tinan.test', username: 'svc', password: 'p'.repeat(40), requestTimeoutMs: 30, fetch: (_i, init) => new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted')))) });
  await assert.rejects(() => provider.getTask(randomUUID()), (e) => e.code === 'NETWORK');
});

test('audit: every sensitive action is logged with the verified actor, never with requirements or secrets', async () => {
  const w = boot();
  const p = await toCompleted(w);
  await w.call('GET', `/api/builder/projects/${p.id}/export`, { as: 'u0@x.test' });
  const h = (await w.call('GET', `/api/builder/projects/${p.id}/history`, { as: 'u0@x.test' })).body.history;
  const actions = h.map((e) => e.action);
  for (const a of ['builder.project.created', 'builder.task.submitted', 'builder.plan.approved', 'builder.approval.forwarded', 'builder.task.completed', 'builder.project.exported']) assert.ok(actions.includes(a), a);
  assert.ok(h.every((e) => e.actor === 'u0@x.test'));
  const approved = h.find((e) => e.action === 'builder.plan.approved');
  assert.equal(approved.detail.digest, p.planDigest);
  const raw = JSON.stringify(h);
  assert.ok(!raw.includes('tiny sum utility') && !raw.includes('p'.repeat(40)));
  const rows = w.db.raw.prepare('SELECT entry_json FROM audit_log').all();
  assert.ok(rows.length >= 6);
});

test('server-to-server auth: Basic credential only, no Access headers or user email forwarded to TINAN AI', async () => {
  const w = boot();
  await toCompleted(w);
  for (const h of w.tinan.headers) {
    assert.ok(h.authorization?.startsWith('Basic '));
    assert.equal(h['x-eureka-delegation'], undefined);
    for (const k of Object.keys(h)) assert.ok(!/^cf-access|^cf-/.test(k), `unexpected header ${k}`);
    assert.ok(!JSON.stringify(h).includes('u0@x.test'));
  }
  assert.ok(w.tinan.headers.filter((h) => h.origin).every((h) => h.origin === 'https://tinan.test'));
});

test('delegated mode: per-user signed delegation, per-user TINAN AI owners, secret never exposed', async () => {
  const tinan = fakeTinan({ delegated: true });
  const w = boot({ tinan, env: { TINANAI_DELEGATION_SECRET: DELEG_SECRET } });
  assert.equal((await w.call('GET', '/api/builder/status', { as: 'viewer@x.test' })).body.integration.authMode, 'delegated');
  const a = await toCompleted(w, 'u6@x.test');
  const b = await toCompleted(w, 'u7@x.test');
  assert.equal(a.status, 'completed');
  assert.equal(b.status, 'completed');
  const owners = new Set([...tinan.tasks.values()].map((t) => t.owner));
  assert.equal(owners.size, 2);
  assert.ok(!owners.has(SVC_OWNER));
  assert.ok(tinan.headers.every((h) => h['x-eureka-delegation']?.startsWith('v1.')));
  assert.ok(!JSON.stringify(tinan.headers).includes('u6@x.test'), 'the email is pseudonymised');
  assert.ok(!JSON.stringify([a, b]).includes(DELEG_SECRET));
  // TINAN AI with delegation disabled refuses rather than serving the shared owner.
  const refused = boot({ env: { TINANAI_DELEGATION_SECRET: DELEG_SECRET } });
  const st = await refused.call('GET', '/api/builder/status', { as: 'viewer@x.test' });
  assert.equal(st.body.integration.state, 'authentication_failed');
  assert.match(st.body.integration.detail, /multi-user delegation disabled/);
  // The secret must differ from the Basic password and be long enough.
  const weak = boot({ env: { TINANAI_DELEGATION_SECRET: 'short' } });
  assert.equal((await weak.call('GET', '/api/builder/status', { as: 'viewer@x.test' })).body.integration.state, 'not_configured');
});

test('delegation token matches TINAN AI verifier (independent HMAC check)', async () => {
  const t = await prov.signDelegationToken(DELEG_SECRET, 'eureka.abc', Math.floor(Date.now() / 1000));
  assert.equal(verifyDelegation(t), 'eureka.abc');
  assert.equal(verifyDelegation(t.slice(0, -1) + (t.endsWith('0') ? '1' : '0')), null);
  assert.match(prov.delegationSubjectFor('A@X.test'), /^eureka\.[0-9a-f]{40}$/);
  assert.equal(prov.delegationSubjectFor('A@X.test'), prov.delegationSubjectFor('a@x.test'));
});

test('Service Binding transport is used when TINANAI_SERVICE is bound; credentials are still required', async () => {
  const tinan = fakeTinan();
  let used = 0;
  const factory = api.makeBuilderFactory({ TINANAI_BUILDER_ENABLED: 'true', TINANAI_BASE_URL: 'https://tinan.test', TINANAI_USERNAME: 'svc', TINANAI_PASSWORD: 'p'.repeat(40), TINANAI_SERVICE: { fetch: (i, init) => { used++; return tinan.handle(new Request(i, init)); } } });
  const client = factory('u0@x.test');
  const t = await client.submitRequirements('hello');
  assert.equal(used, 1);
  assert.ok(tinan.headers[0].authorization.startsWith('Basic '));
  assert.equal(t.status, 'planning');
  assert.equal(api.makeBuilderFactory({ TINANAI_BUILDER_ENABLED: 'true' })('u0@x.test'), undefined);
});

test('Contract v1.1 compatibility: existing adapter surface and constants are unchanged', async () => {
  const core = await loadSource('src/core/builder.ts');
  assert.equal(core.BUILDER_CONTRACT_VERSION, '1.1');
  const p = new prov.TinanAiBuilderProvider({ baseUrl: 'https://tinan.test', username: 'svc', password: 'p'.repeat(40) });
  for (const m of ['submitRequirements', 'getTask', 'forwardApproval', 'getManifest', 'listFiles', 'readFile', 'cancel']) assert.equal(typeof p[m], 'function');
  assert.equal(p.ownerId, SVC_OWNER);
  assert.equal(planDigestOf(PLAN), core.planDigest(PLAN));
  const entries = [{ path: 'b', bytes: 1, sha256: sha('b') }, { path: 'a', bytes: 1, sha256: sha('a') }];
  assert.equal(core.manifestDigest(planDigestOf(PLAN), entries), manifestDigestOf(planDigestOf(PLAN), entries));
});

test('history aggregates only the caller\'s projects', async () => {
  const w = boot();
  await toAwaiting(w, 'u8@x.test');
  await toAwaiting(w, 'u9@x.test');
  const h8 = (await w.call('GET', '/api/builder/history', { as: 'u8@x.test' })).body.history;
  assert.ok(h8.length >= 2);
  assert.ok(h8.every((e) => e.actor === 'u8@x.test'));
});

test('writes are rate limited per verified identity', async () => {
  const w = boot();
  let limited = 0;
  for (let i = 0; i < 35; i++) if ((await w.call('POST', '/api/builder/projects', { as: 'u11@x.test', body: { name: '', requirements: '' }, realClock: true })).status === 429) limited++;
  assert.ok(limited >= 5);
});
