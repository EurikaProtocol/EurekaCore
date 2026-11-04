import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after, before } from 'node:test';
import { execFileSync } from 'node:child_process';
import { loadSource, makeFakeGitHub, makeFakeTinan, makeIdentityProvider, migrate, startWorker } from './helpers/worker-harness.mjs';

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
  return { ...w, github, tinan, t, persist };
}
const create = (w, id, extra = {}) => w.call('POST', '/api/workflows', { token: w.t.op, body: { id, objective: 'Build a tiny sum utility with tests', productId: 'tinan-ai', pipeline: 'pr-delivery-v1', grantedLevel: 3, ...extra } });
const advance = async (w, id) => {
  const r = await w.call('POST', `/api/workflows/${id}/advance`, { token: w.t.op, body: {} });
  if (process.env.DEBUG_WORKER && r.body?.workflow) console.error('STAGES', JSON.stringify(r.body.workflow.stages.map((s) => [s.id, s.status, s.error])));
  return r;
};
const approve = async (w, id, extra = {}) => {
  const wf = (await w.call('GET', `/api/workflows/${id}`, { token: w.t.viewer })).body.workflow;
  return w.call('POST', `/api/workflows/${id}/approve`, { token: w.t.alice, body: { stageId: 'plan-approval', digest: wf.pendingApproval.digest, ...extra } });
};

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

test('end to end: requirements -> architecture -> human approval -> branch -> generation -> sandbox tests -> draft PR', { skip: !dockerUp && 'docker image node:22-alpine unavailable' }, async () => {
  const w = await boot();
  try {
    assert.equal((await create(w, 'e2e')).status, 201);
    let r = await advance(w, 'e2e');
    assert.equal(r.body.workflow.status, 'awaiting-approval');
    assert.deepEqual(r.body.workflow.stages.map((s) => s.status), ['completed', 'completed', 'awaiting-approval', 'pending', 'pending', 'pending', 'pending']);
    assert.equal(w.github.mutations.length, 0); // nothing written before approval

    // pending approvals are listed with the review package
    const pending = await w.call('GET', '/api/approvals', { token: w.t.viewer });
    assert.equal(pending.body.approvals.length, 1);
    assert.ok(pending.body.approvals[0].review.requirements);

    // only an approver may approve; wrong digest refused; body identity ignored
    assert.equal((await w.call('POST', '/api/workflows/e2e/approve', { token: w.t.op, body: { stageId: 'plan-approval', digest: r.body.workflow.pendingApproval.digest } })).status, 403);
    assert.equal((await w.call('POST', '/api/workflows/e2e/approve', { token: w.t.alice, body: { stageId: 'plan-approval', digest: '0xbad' } })).status, 403);
    assert.equal((await advance(w, 'e2e')).body.workflow.status, 'awaiting-approval'); // still waiting
    assert.equal(w.github.mutations.length, 0);
    const ap = await approve(w, 'e2e', { approver: 'mallory@evil.test', approvedBy: 'mallory@evil.test' });
    assert.equal(ap.status, 200);
    assert.equal(ap.body.workflow.stages[2].approval.approvedBy, 'alice@x.test');

    r = await advance(w, 'e2e');
    assert.equal(r.status, 200);
    assert.equal(r.body.workflow.status, 'completed', JSON.stringify(r.body.workflow.reason));
    const stages = r.body.workflow.stages;
    assert.ok(stages.every((s) => ['completed', 'approved'].includes(s.status)));
    for (const s of stages.filter((x) => x.verification.length)) assert.ok(s.verification.every((v) => v.passed && v.evidence));

    // GitHub side effects: only an eureka/ branch, never main, a DRAFT PR, never merged
    const refs = w.github.mutations.filter((m) => m.rest === '/git/refs');
    assert.equal(refs.length, 1);
    assert.match(refs[0].body.ref, /^refs\/heads\/eureka\/e2e$/);
    assert.ok(w.github.mutations.every((m) => !/main/.test(JSON.stringify(m.body?.branch ?? '')) && !/merge/.test(m.rest) && m.method !== 'DELETE' && m.method !== 'PATCH'));
    assert.equal(w.github.prs.length, 1);
    assert.equal(w.github.prs[0].draft, true);
    assert.equal(w.github.prs[0].base, 'main');
    assert.equal(w.github.prs[0].merged, false);
    assert.deepEqual([...w.github.auth], ['Bearer ghp_faketesttoken']);
    assert.ok(w.github.files.has('eureka/e2e:generated/e2e/sum.test.mjs'));
    // the sandbox really ran the generated tests
    const testing = JSON.parse(stages[5].output);
    assert.equal(testing.exitCode, 0);
    assert.match(testing.stdout, /pass 1/);
    assert.equal(testing.isolation.network, 'none');

    // audit trail is a valid chain and records the verified human
    const audit = (await w.call('GET', '/api/audit', { token: w.t.viewer })).body.entries;
    assert.equal(sdk.verifyAuditChain(audit).valid, true);
    assert.ok(audit.some((e) => e.action === 'stage.approved' && e.actor === 'alice@x.test'));
    assert.ok(!audit.some((e) => e.actor.includes('mallory')));
  } finally { await w.dispose(); }
});

test('failing generated tests: no pull request is opened', { skip: !dockerUp && 'docker image node:22-alpine unavailable' }, async () => {
  const w = await boot({ tinan: makeFakeTinan({ failingTests: true }) });
  try {
    await create(w, 'bad');
    await advance(w, 'bad');
    await approve(w, 'bad');
    const r = await advance(w, 'bad');
    assert.equal(r.body.workflow.status, 'failed');
    assert.match(r.body.workflow.reason, /testing/);
    assert.equal(r.body.workflow.stages[5].status, 'failed');
    assert.equal(w.github.prs.length, 0);
    assert.equal(r.body.workflow.stages[6].status, 'pending');
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
  const w = await boot();
  try {
    await create(w, 'cc');
    await advance(w, 'cc');
    await approve(w, 'cc');
    const results = await Promise.all([advance(w, 'cc'), advance(w, 'cc'), advance(w, 'cc')]);
    assert.ok(results.every((r) => [200, 409].includes(r.status)), JSON.stringify(results.map((r) => r.status)));
    assert.ok(results.some((r) => r.status === 200));
    // settle: keep advancing until completed (a 409 loser may have left work for a later call)
    let wf;
    for (let i = 0; i < 4; i++) { wf = (await advance(w, 'cc')).body?.workflow; if (wf?.status === 'completed') break; await new Promise((r) => setTimeout(r, 300)); }
    assert.equal(wf.status, 'completed');
    assert.equal(w.github.mutations.filter((m) => m.rest === '/git/refs').length, 1);
    assert.equal(w.github.prs.length, 1);
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
