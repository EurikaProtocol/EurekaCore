import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after, before } from 'node:test';
import { execFileSync } from 'node:child_process';
import { loadSource, makeFakeGitHub, makeFakeTinan, makeFakeBuilder, makeIdentityProvider, migrate, startWorker } from './helpers/worker-harness.mjs';

/*
 * Runs the REAL Worker bundle in workerd (Miniflare) with a REAL local D1 whose schema is created by
 * `wrangler d1 migrations apply --local` (migrations 0001 + 0002), real RS256 verification of Access-style JWTs,
 * and the REAL Docker sandbox. GitHub and TinanAi are contract-level fakes behind the Worker's outbound fetch:
 * these tests do NOT prove behaviour against live GitHub, live TinanAi or remote Cloudflare D1.
 */
const sdk = await loadSource('src/sdk/index.ts');
const { DockerSandboxRunner } = await loadSource('src/sandbox/docker-runner.ts');
const dockerUp = (() => { try { execFileSync('docker', ['image', 'inspect', 'node:22-alpine'], { stdio: 'ignore' }); return true; } catch { return false; } })();

let template;
let idp;
const dirs = [];
before(async () => {
  template = mkdtempSync(join(tmpdir(), 'eureka-d1tpl-'));
  migrate(template);
  idp = await makeIdentityProvider();
});
after(() => { for (const d of [template, ...dirs]) rmSync(d, { recursive: true, force: true }); });

async function boot(opts = {}) {
  const persist = opts.persist ?? mkdtempSync(join(tmpdir(), 'eureka-d1-'));
  if (!opts.persist) { cpSync(template, persist, { recursive: true }); dirs.push(persist); }
  const github = opts.github ?? makeFakeGitHub();
  const tinan = opts.tinan ?? makeFakeTinan();
  const w = await startWorker({ persist, idp, github, tinan, sandboxRunner: new DockerSandboxRunner(), ...opts });
  const t = {
    op: await idp.sign('op@x.test'), alice: await idp.sign('alice@x.test'), viewer: await idp.sign('viewer@x.test'),
  };
  return { ...w, github, tinan, builder: opts.builder, t, persist };
}
const create = (w, id, extra = {}) => w.call('POST', '/api/workflows', { token: w.t.op, body: { id, objective: 'Build a tiny sum utility with tests', productId: 'tinan-ai', pipeline: 'pr-delivery-v1', grantedLevel: 3, ...extra } });
const advance = async (w, id) => {
  const r = await w.call('POST', `/api/workflows/${id}/advance`, { token: w.t.op, body: {} });
  if (process.env.DEBUG_WORKER && r.body?.workflow) console.error('STAGES', JSON.stringify(r.body.workflow.stages.map((s) => [s.id, s.status, s.error])));
  return r;
};
const approve = async (w, id, extra = {}, stageId = 'plan-approval') => {
  const wf = (await w.call('GET', `/api/workflows/${id}`, { token: w.t.viewer })).body.workflow;
  return w.call('POST', `/api/workflows/${id}/approve`, { token: w.t.alice, body: { stageId, digest: wf.pendingApproval.digest, ...extra } });
};
const BUILDER_ENV = { TINANAI_BUILDER_ENABLED: 'true' };
const bootBuilder = (opts = {}) => boot({ builder: makeFakeBuilder(opts.builderMode), extraBindings: BUILDER_ENV, ...opts });
const createB = (w, id, extra = {}) => create(w, id, { pipeline: 'builder-delivery-v1', ...extra });
/** Drives a builder workflow through both human gates and returns the result of the final advance. */
async function driveBuilder(w, id) {
  let r = await advance(w, id);
  assert.equal(r.body.workflow.status, 'awaiting-approval', JSON.stringify(r.body.workflow.reason));
  assert.equal((await approve(w, id)).status, 200);
  r = await advance(w, id);
  assert.equal(r.body.workflow.status, 'awaiting-approval', JSON.stringify(r.body.workflow.reason));
  assert.equal((await approve(w, id, {}, 'files-approval')).status, 200);
  return advance(w, id);
}

test('authentication fails closed and never trusts client-supplied identity', async () => {
  const w = await boot();
  try {
    assert.equal((await w.call('GET', '/api/products')).status, 401);
    assert.equal((await w.call('GET', '/api/products', { token: 'a.b.c' })).status, 401);
    assert.equal((await w.call('GET', '/api/products', { token: await idp.sign('op@x.test', { key: idp.otherKey }) })).status, 401); // wrong signing key
    assert.equal((await w.call('GET', '/api/products', { token: await idp.sign('op@x.test', { aud: 'other' }) })).status, 401);
    assert.equal((await w.call('GET', '/api/products', { token: await idp.sign('op@x.test', { iss: 'https://evil.cloudflareaccess.com' }) })).status, 401);
    assert.equal((await w.call('GET', '/api/products', { token: await idp.sign('op@x.test', { exp: 1 }) })).status, 401);
    assert.equal((await w.call('GET', '/api/products', { token: await idp.sign('stranger@x.test') })).status, 403);
    assert.equal((await w.call('GET', '/api/products', { token: w.t.op, headers: { 'X-Forwarded-Email': 'alice@x.test', 'Cf-Access-Authenticated-User-Email': 'alice@x.test' } })).body.products.length, 4);
    const who = await w.call('GET', '/api/session', { token: w.t.op, headers: { 'Cf-Access-Authenticated-User-Email': 'alice@x.test' } });
    assert.deepEqual(who.body, { email: 'op@x.test', roles: ['operator', 'viewer'] });
    // CSRF: same-origin Origin header is required for writes
    assert.equal((await w.call('POST', '/api/workflows', { token: w.t.op, body: { id: 'x' }, origin: 'https://evil.test' })).status, 403);
    assert.equal((await w.call('POST', '/api/workflows', { token: w.t.op, body: { id: 'x' }, origin: null })).status, 403);
    // roles
    assert.equal((await create(w, 'v1')).status, 201);
    assert.equal((await w.call('POST', '/api/workflows', { token: w.t.viewer, body: { id: 'nope', objective: 'x' } })).status, 403);
    assert.equal((await w.call('POST', '/api/workflows/v1/advance', { token: w.t.viewer, body: {} })).status, 403);
  } finally { await w.dispose(); }
});

test('API is closed (503) when Access is not configured', async () => {
  const w = await boot({ authConfigured: false });
  try { assert.equal((await w.call('GET', '/api/products', { token: w.t.op })).status, 503); } finally { await w.dispose(); }
});

test('rejects request bodies exceeding the 16 KB byte limit', async () => {
  const w = await boot();
  try {
    const r = await w.call('POST', '/api/workflows', {
      token: w.t.op,
      body: { id: 'large-body', objective: 'Build a tiny utility', extra: '😀'.repeat(5000) },
    });
    assert.equal(r.status, 400);
  } finally { await w.dispose(); }
});

test('real D1: migrations 0001+0002 applied; integrations probe reports what is real', async () => {
  const w = await boot();
  try {
    const r = await w.call('GET', '/api/integrations', { token: w.t.viewer });
    assert.equal(r.body.integrations.database.status, 'healthy');
    assert.equal(r.body.integrations.github.status, 'healthy');
    assert.equal(r.body.integrations.tinanai.status, 'configured'); // not probed, not claimed healthy
    assert.equal(r.body.integrations.sandbox.status, 'configured');
  } finally { await w.dispose(); }
});

test('writes are rate limited per verified identity (429) while reads are not', async () => {
  const w = await boot();
  try {
    let last;
    for (let i = 0; i < 31; i++) last = await w.call('POST', '/api/workflows', { token: w.t.viewer, body: { id: 'x' } });
    assert.equal(last.status, 429);
    assert.equal((await w.call('GET', '/api/session', { token: w.t.viewer })).status, 200);
  } finally { await w.dispose(); }
});

test('product permission ceiling is enforced through the API', async () => {
  const w = await boot();
  try {
    assert.equal((await create(w, 'p1', { productId: 'marketplace' })).status, 403);
    assert.equal((await create(w, 'p2', { grantedLevel: 5 })).status, 400);
    assert.equal((await create(w, 'p3', { pipeline: 'nope' })).status, 400);
  } finally { await w.dispose(); }
});

test('end to end (builder-delivery-v1): plan -> human plan approval -> generation -> human file approval -> branch -> commit/read-back -> sandbox tests -> draft PR', { skip: !dockerUp && 'docker image node:22-alpine unavailable' }, async () => {
  const w = await bootBuilder();
  try {
    assert.equal((await createB(w, 'e2e')).status, 201);
    let r = await advance(w, 'e2e');
    assert.equal(r.body.workflow.status, 'awaiting-approval');
    assert.deepEqual(r.body.workflow.stages.map((s) => s.status), ['completed', 'completed', 'awaiting-approval', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending']);
    assert.equal(w.github.mutations.length, 0);
    assert.equal(w.builder.approvals, 0, 'TINAN AI must not be told to generate before EurekaCore approval');

    assert.equal((await w.call('POST', '/api/workflows/e2e/approve', { token: w.t.op, body: { stageId: 'plan-approval', digest: r.body.workflow.pendingApproval.digest } })).status, 403);
    assert.equal((await w.call('POST', '/api/workflows/e2e/approve', { token: w.t.alice, body: { stageId: 'plan-approval', digest: '0xbad' } })).status, 403);
    const ap = await approve(w, 'e2e', { approver: 'mallory@evil.test', approvedBy: 'mallory@evil.test' });
    assert.equal(ap.status, 200);
    assert.equal(ap.body.workflow.stages[2].approval.approvedBy, 'alice@x.test');

    r = await advance(w, 'e2e');
    assert.equal(r.body.workflow.status, 'awaiting-approval', JSON.stringify(r.body.workflow.reason));
    assert.equal(w.builder.approvals, 1);
    assert.equal(w.github.mutations.length, 0, 'generated files are not written before the second human gate');
    assert.equal((await approve(w, 'e2e', {}, 'files-approval')).status, 200);

    r = await advance(w, 'e2e');
    assert.equal(r.body.workflow.status, 'completed', JSON.stringify(r.body.workflow.reason));
    const stages = r.body.workflow.stages;
    for (const s of stages.filter((x) => x.verification.length)) assert.ok(s.verification.every((v) => v.passed && v.evidence));
    const refs = w.github.mutations.filter((m) => m.rest === '/git/refs');
    assert.equal(refs.length, 1);
    assert.match(refs[0].body.ref, /^refs\/heads\/eureka\/e2e$/);
    assert.ok(w.github.mutations.every((m) => !/merge/.test(m.rest) && m.method !== 'DELETE' && m.method !== 'PATCH'));
    assert.equal(w.github.prs.length, 1);
    assert.equal(w.github.prs[0].draft, true);
    assert.equal(w.github.prs[0].merged, false);
    assert.ok(w.github.files.has('eureka/e2e:generated/e2e/sum.test.mjs'));
    const testing = JSON.parse(stages[7].output);
    assert.equal(testing.exitCode, 0);
    assert.equal(testing.isolation.network, 'none');
    const audit = (await w.call('GET', '/api/audit', { token: w.t.viewer })).body.entries;
    assert.equal(sdk.verifyAuditChain(audit).valid, true);
    assert.ok(audit.filter((e) => e.action === 'stage.approved' && e.actor === 'alice@x.test').length === 2);
    assert.ok(!audit.some((e) => e.actor.includes('mallory')));
  } finally { await w.dispose(); }
});

test('failing generated tests: no pull request is opened', { skip: !dockerUp && 'docker image node:22-alpine unavailable' }, async () => {
  const w = await bootBuilder({ builderMode: { failingTests: true } });
  try {
    await createB(w, 'bad');
    const r = await driveBuilder(w, 'bad');
    assert.equal(r.body.workflow.status, 'failed');
    assert.match(r.body.workflow.reason, /testing/);
    assert.equal(r.body.workflow.stages[7].status, 'failed');
    assert.equal(w.github.prs.length, 0);
    assert.equal(r.body.workflow.stages[8].status, 'pending');
  } finally { await w.dispose(); }
});

test('builder-delivery-v1 without TINANAI_BUILDER_ENABLED blocks with a configuration message and touches nothing', async () => {
  const w = await boot({ builder: makeFakeBuilder() });
  try {
    await createB(w, 'nb');
    const r = await advance(w, 'nb');
    assert.equal(r.body.workflow.status, 'blocked');
    assert.match(r.body.workflow.reason, /TINANAI_BUILDER_ENABLED/);
    assert.deepEqual(w.builder.calls, []);
    assert.equal(w.github.mutations.length, 0);
    assert.equal(w.github.prs.length, 0);
  } finally { await w.dispose(); }
});

test('pr-delivery-v1 (legacy) blocks at generation: an agent plan summary is never source code', async () => {
  const w = await boot({ tinan: makeFakeTinan() });
  try {
    await create(w, 'lg');
    await advance(w, 'lg');
    await approve(w, 'lg');
    const r = await advance(w, 'lg');
    assert.equal(r.body.workflow.status, 'blocked');
    assert.match(r.body.workflow.reason, /builder-delivery-v1/);
    assert.equal(w.github.mutations.length, 0);
    assert.equal(w.github.prs.length, 0);
  } finally { await w.dispose(); }
});

test('no verified sandbox: files are committed as a reviewable proposal, tests are not claimed, no PR is opened', async () => {
  const w = await bootBuilder({ extraBindings: { ...BUILDER_ENV, SANDBOX_URL: '', SANDBOX_TOKEN: '' } });
  try {
    await createB(w, 'ns');
    const r = await driveBuilder(w, 'ns');
    assert.equal(r.body.workflow.status, 'blocked');
    assert.match(r.body.workflow.reason, /sandbox/i);
    assert.equal(r.body.workflow.stages[6].status, 'completed');
    assert.equal(r.body.workflow.stages[7].status, 'pending');
    assert.equal(w.github.prs.length, 0);
    assert.ok(w.github.files.has('eureka/ns:generated/ns/sum.mjs'));
  } finally { await w.dispose(); }
});

test('Builder owned by someone else is refused: nothing is approved, generated or committed', async () => {
  const w = await bootBuilder({ builderMode: { ownerId: 'f'.repeat(64) } });
  try {
    await createB(w, 'om');
    const r = await advance(w, 'om');
    assert.notEqual(r.body.workflow.status, 'awaiting-approval');
    assert.equal(w.builder.approvals, 0);
    assert.equal(w.github.mutations.length, 0);
  } finally { await w.dispose(); }
});

test('cancelling a builder workflow cancels the Builder task and stops GitHub side effects', async () => {
  const w = await bootBuilder();
  try {
    await createB(w, 'cb');
    await advance(w, 'cb');
    assert.equal((await w.call('POST', '/api/workflows/cb/cancel', { token: w.t.op, body: {} })).body.workflow.status, 'cancelled');
    assert.equal(w.builder.cancels, 1);
    assert.equal((await advance(w, 'cb')).body.workflow.status, 'cancelled');
    assert.equal(w.github.mutations.length, 0);
    assert.equal(w.builder.approvals, 0);
  } finally { await w.dispose(); }
});

test('provider failure fails the stage with its reason; retry resumes once the provider recovers; no mock fallback', async () => {
  const tinan = makeFakeTinan({ fail: 500 });
  const w = await boot({ tinan });
  try {
    await create(w, 'pf');
    const r = await advance(w, 'pf');
    assert.equal(r.body.workflow.status, 'failed');
    assert.match(r.body.workflow.reason, /requirements/);
    assert.equal(r.body.workflow.stages[0].output, null);
    tinan.mode.fail = 0;
    assert.equal((await w.call('POST', '/api/workflows/pf/retry', { token: w.t.op, body: {} })).status, 200);
    assert.equal((await advance(w, 'pf')).body.workflow.status, 'awaiting-approval');
  } finally { await w.dispose(); }
});

test('missing configuration blocks the stage instead of faking it', async () => {
  const w = await boot({ extraBindings: { GITHUB_TOKEN: '' } });
  try {
    await create(w, 'nc');
    await advance(w, 'nc');
    await approve(w, 'nc');
    const r = await advance(w, 'nc');
    assert.equal(r.body.workflow.status, 'blocked');
    assert.match(r.body.workflow.reason, /No executor.*branch/);
    assert.equal(w.github.mutations.length, 0);
  } finally { await w.dispose(); }
});

test('cancellation during a running stage discards the late result and stops side effects', async () => {
  const tinan = makeFakeTinan({ delayMs: 800 });
  const w = await boot({ tinan });
  try {
    await create(w, 'cx');
    const running = advance(w, 'cx');
    await new Promise((r) => setTimeout(r, 300));
    assert.equal((await w.call('POST', '/api/workflows/cx/cancel', { token: w.t.op, body: {} })).body.workflow.status, 'cancelled');
    const done = await running;
    assert.equal(done.body.workflow.status, 'cancelled');
    const final = (await w.call('GET', '/api/workflows/cx', { token: w.t.viewer })).body.workflow;
    assert.equal(final.stages[0].output, null);
    assert.equal(w.github.mutations.length, 0);
    assert.equal((await w.call('POST', '/api/workflows/cx/cancel', { token: w.t.op, body: {} })).status, 409);
  } finally { await w.dispose(); }
});

test('concurrent advance: exactly one runner wins each stage; no duplicate side effects', { skip: !dockerUp && 'docker image node:22-alpine unavailable' }, async () => {
  const w = await bootBuilder();
  try {
    await createB(w, 'cc');
    await advance(w, 'cc');
    await approve(w, 'cc');
    await advance(w, 'cc');
    await approve(w, 'cc', {}, 'files-approval');
    const results = await Promise.all([advance(w, 'cc'), advance(w, 'cc'), advance(w, 'cc')]);
    assert.ok(results.every((r) => [200, 409].includes(r.status)), JSON.stringify(results.map((r) => r.status)));
    assert.ok(results.some((r) => r.status === 200));
    let wf;
    for (let i = 0; i < 4; i++) { wf = (await advance(w, 'cc')).body?.workflow; if (wf?.status === 'completed') break; await new Promise((r) => setTimeout(r, 300)); }
    assert.equal(wf.status, 'completed');
    assert.equal(w.github.mutations.filter((m) => m.rest === '/git/refs').length, 1);
    assert.equal(w.github.prs.length, 1);
    assert.equal(w.builder.approvals, 1);
    assert.equal(sdk.verifyAuditChain((await w.call('GET', '/api/audit', { token: w.t.viewer })).body.entries).valid, true);
  } finally { await w.dispose(); }
});

test('state survives a Worker restart on the same D1 storage', async () => {
  const persist = mkdtempSync(join(tmpdir(), 'eureka-d1-')); cpSync(template, persist, { recursive: true }); dirs.push(persist);
  let w = await boot({ persist });
  await create(w, 'rs');
  await advance(w, 'rs');
  await w.dispose();
  w = await boot({ persist });
  try {
    const r = await w.call('GET', '/api/workflows/rs', { token: w.t.viewer });
    assert.equal(r.body.workflow.status, 'awaiting-approval');
    assert.equal((await approve(w, 'rs')).status, 200);
  } finally { await w.dispose(); }
});
