import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadSource } from './helpers/load-src.mjs';
import { openD1Shim } from './helpers/d1-shim.mjs';

const sdk = await loadSource('src/sdk/index.ts');
const server = await loadSource('src/server/d1.ts');
const { MockAgentProvider } = await loadSource('src/testing/mock-agent.ts');

let tick = 0;
const clock = () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString();
const setup = (opts = {}) => {
  const audit = opts.audit ?? new sdk.InMemoryAuditLog();
  const store = opts.store ?? new sdk.InMemoryWorkflowStore();
  const registry = sdk.createDefaultRegistry();
  return { audit, store, engine: new sdk.WorkflowEngine(store, audit, registry, clock) };
};

/** Test handler: passes every acceptance criterion with evidence. */
const passing = (output = 'ok', overrides = {}) => ({
  execute: async () => ({ output }),
  verify: async (ctx) => ctx.stage.acceptance.map((criterion) => ({ criterion, passed: true, evidence: `checked ${criterion}` })),
  ...overrides,
});
const handlersFor = (ids, h = passing) => Object.fromEntries(ids.map((id) => [id, h()]));
const PLAN = ['requirements', 'research', 'architecture', 'plan'];

test('permission tiers: levels 5-6 are never autonomously permitted', () => {
  assert.equal(sdk.isAutonomouslyPermitted(4, 4), true);
  assert.equal(sdk.isAutonomouslyPermitted(3, 4), false);
  assert.equal(sdk.isAutonomouslyPermitted(6, 5), false);
  assert.equal(sdk.isAutonomouslyPermitted(6, 6), false);
  assert.equal(sdk.isPermissionLevel(7), false);
  assert.equal(sdk.isPermissionLevel(2.5), false);
});

test('registry: defaults are honest and validation rejects fabricated claims', () => {
  const reg = sdk.createDefaultRegistry();
  assert.deepEqual(reg.list().map((p) => p.id), ['tinan-ai', 'token-launchpad', 'data-layer', 'marketplace']);
  for (const p of reg.list()) assert.equal(p.health.status, 'unverified');
  assert.equal(reg.get('marketplace').apiBaseUrl, null);
  const base = reg.get('tinan-ai');
  assert.equal(reg.register(base).ok, false); // duplicate
  const bad = (patch) => sdk.validateProduct({ ...base, id: 'x-product', ...patch }).ok;
  assert.equal(bad({ apiBaseUrl: 'http://insecure.example' }), false);
  assert.equal(bad({ apiBaseUrl: 'https://user:pw@example.com' }), false);
  assert.equal(bad({ maxPermissionLevel: 9 }), false);
  assert.equal(bad({ health: { status: 'healthy', checkedAt: '2026-01-01T00:00:00.000Z' } }), false); // no API url / not verified-live
  assert.equal(reg.recordHealth('tinan-ai', 'healthy', '2026-01-01T00:00:00.000Z').ok, false);
  assert.equal(bad({ apiBaseUrl: 'https://api.example.com', integrationStatus: 'verified-live', health: { status: 'healthy', checkedAt: '2026-01-01T00:00:00.000Z' } }), true);
});

test('audit chain detects tampering', async () => {
  const log = new sdk.InMemoryAuditLog();
  for (let i = 0; i < 3; i++) await log.append({ at: '2026-01-01T00:00:00.000Z', actor: 'a', action: 'x', subject: 's', detail: { i } });
  const entries = await log.list();
  assert.deepEqual(sdk.verifyAuditChain(entries), { valid: true, brokenAt: null });
  const edited = structuredClone(entries);
  edited[1].detail.i = 99;
  assert.deepEqual(sdk.verifyAuditChain(edited), { valid: false, brokenAt: 2 });
  assert.equal(sdk.verifyAuditChain([entries[0], entries[2]]).valid, false);
});

test('create validates input, product linkage and permission ceiling', async () => {
  const { engine } = setup();
  assert.equal((await engine.create({ id: 'bad id', objective: 'x' })).ok, false);
  assert.equal((await engine.create({ id: 'w', objective: '  ' })).ok, false);
  assert.equal((await engine.create({ id: 'w', objective: 'x', productId: 'nope' })).ok, false);
  assert.equal((await engine.create({ id: 'w', objective: 'x', productId: 'tinan-ai', grantedLevel: 4 })).error.code, 'UNAUTHORIZED');
  assert.equal((await engine.create({ id: 'w', objective: 'x', productId: 'tinan-ai', grantedLevel: 2 })).ok, true);
  assert.equal((await engine.create({ id: 'w', objective: 'x' })).ok, false); // duplicate
});

test('runs the planning stages, then stops at the human plan gate', async () => {
  const { engine, audit } = setup();
  await engine.create({ id: 'w1', objective: 'build a site' });
  const r = await engine.advance('w1', handlersFor(PLAN));
  assert.equal(r.value.status, 'awaiting-approval');
  assert.deepEqual(r.value.stages.slice(0, 5).map((s) => s.status), ['completed', 'completed', 'completed', 'completed', 'awaiting-approval']);
  assert.equal(r.value.stages[0].verification.length, 2);
  assert.ok(r.value.stages.slice(5).every((s) => s.status === 'pending'));
  const again = await engine.advance('w1', handlersFor(PLAN));
  assert.equal(again.value.version, r.value.version); // idempotent while waiting
  assert.equal(sdk.verifyAuditChain(await audit.list()).valid, true);
});

test('approval needs a named human and the exact current digest', async () => {
  const { engine } = setup();
  await engine.create({ id: 'w1', objective: 'o', grantedLevel: 3 });
  const w = (await engine.advance('w1', handlersFor(PLAN))).value;
  const digest = sdk.reviewDigest(w, 'plan-approval');
  assert.equal((await engine.approve('w1', 'plan-approval', 'orchestrator', digest)).error.code, 'UNAUTHORIZED');
  assert.equal((await engine.approve('w1', 'plan-approval', '', digest)).error.code, 'UNAUTHORIZED');
  assert.equal((await engine.approve('w1', 'plan-approval', 'alice', '0xdead')).error.code, 'UNAUTHORIZED');
  assert.equal((await engine.approve('w1', 'generation', 'alice', digest)).ok, false);
  const ok = await engine.approve('w1', 'plan-approval', 'alice', digest);
  assert.equal(ok.value.stages[4].approval.approvedBy, 'alice');
  assert.equal((await engine.approve('w1', 'plan-approval', 'alice', digest)).ok, false); // single use
});

test('a stage without an executor blocks instead of being simulated; no stage is skipped', async () => {
  const { engine } = setup();
  await engine.create({ id: 'w1', objective: 'o', grantedLevel: 3 });
  const w = (await engine.advance('w1', handlersFor(PLAN))).value;
  await engine.approve('w1', 'plan-approval', 'alice', sdk.reviewDigest(w, 'plan-approval'));
  const r = await engine.advance('w1', handlersFor(PLAN));
  assert.equal(r.value.status, 'blocked');
  assert.match(r.value.reason, /No executor.*generation/);
  assert.equal(r.value.stages[5].status, 'pending');
  assert.equal(r.value.stages[6].status, 'pending');
});

test('stage above the granted level is blocked before any executor runs', async () => {
  const { engine } = setup();
  await engine.create({ id: 'w1', objective: 'o', grantedLevel: 2 });
  const w = (await engine.advance('w1', handlersFor(PLAN))).value;
  await engine.approve('w1', 'plan-approval', 'alice', sdk.reviewDigest(w, 'plan-approval'));
  let ran = false;
  const r = await engine.advance('w1', { generation: passing('x', { execute: async () => { ran = true; return { output: 'x' }; } }) });
  assert.equal(ran, false);
  assert.equal(r.value.status, 'blocked');
  assert.match(r.value.reason, /needs level 3/);
});

test('a stage is not completed unless every criterion is verified with evidence', async () => {
  const cases = {
    missing: async (ctx) => [{ criterion: ctx.stage.acceptance[0], passed: true, evidence: 'e' }],
    failed: async (ctx) => ctx.stage.acceptance.map((criterion) => ({ criterion, passed: false, evidence: 'nope' })),
    noEvidence: async (ctx) => ctx.stage.acceptance.map((criterion) => ({ criterion, passed: true, evidence: ' ' })),
    garbage: async () => 'looks good',
  };
  for (const [name, verify] of Object.entries(cases)) {
    const { engine } = setup();
    await engine.create({ id: 'w', objective: 'o' });
    const r = await engine.advance('w', { requirements: passing('ok', { verify }) });
    assert.equal(r.value.status, 'failed', name);
    assert.equal(r.value.stages[0].status, 'failed', name);
    assert.equal(r.value.stages[0].output, null, name);
  }
});

test('executor errors, malformed output and timeouts fail the stage; retry is bounded', async () => {
  const { engine } = setup();
  await engine.create({ id: 'w', objective: 'o' });
  const boom = { requirements: passing('x', { execute: async () => { throw new Error('boom'); } }) };
  assert.match((await engine.advance('w', boom)).value.reason, /boom/);
  assert.equal((await engine.retry('w')).ok, true);
  const hang = { requirements: passing('x', { execute: () => new Promise(() => {}) }) };
  assert.match((await engine.advance('w', hang, { timeoutMs: 20 })).value.reason, /timed out/);
  await engine.retry('w');
  const bad = { requirements: passing('x', { execute: async () => ({ output: 42 }) }) };
  assert.match((await engine.advance('w', bad)).value.reason, /malformed/);
  assert.equal((await engine.retry('w')).ok, false); // 3 attempts used
  assert.equal((await engine.get('w')).stages[0].attempts, 3);
});

test('full pipeline reaches completion only through both human gates; production stage is gated', async () => {
  const { engine, audit } = setup();
  await engine.create({ id: 'w', objective: 'ship it', grantedLevel: 4 });
  const all = handlersFor(sdk.PROJECT_PIPELINE.filter((s) => s.kind === 'work').map((s) => s.id));
  let w = (await engine.advance('w', all)).value;
  assert.equal(w.stages[4].status, 'awaiting-approval');
  await engine.approve('w', 'plan-approval', 'alice', sdk.reviewDigest(w, 'plan-approval'));
  w = (await engine.advance('w', all)).value;
  assert.equal(w.status, 'awaiting-approval');
  assert.equal(w.stages[10].id, 'deployment-approval');
  assert.equal(w.stages[11].status, 'pending'); // production deployment has not run
  // Granting level 6 does not bypass the gate.
  await engine.approve('w', 'deployment-approval', 'bob', sdk.reviewDigest(w, 'deployment-approval'));
  w = (await engine.advance('w', all)).value;
  assert.equal(w.status, 'completed');
  assert.ok(w.stages.every((s) => ['completed', 'approved'].includes(s.status)));
  const entries = await audit.list('w');
  assert.ok(entries.some((e) => e.action === 'stage.approved' && e.actor === 'bob'));
  assert.equal(sdk.verifyAuditChain(await audit.list()).valid, true);
});

test('rejecting a gate cancels the workflow; cancel discards late results', async () => {
  const a = setup();
  await a.engine.create({ id: 'w', objective: 'o' });
  await a.engine.advance('w', handlersFor(PLAN));
  const rej = await a.engine.reject('w', 'plan-approval', 'alice', 'not good');
  assert.equal(rej.value.status, 'cancelled');
  assert.equal((await a.engine.advance('w', handlersFor(PLAN))).value.status, 'cancelled');

  const b = setup();
  await b.engine.create({ id: 'w', objective: 'o' });
  let release;
  const slow = { requirements: passing('late', { execute: () => new Promise((res) => { release = () => res({ output: 'late' }); }) }) };
  const pending = b.engine.advance('w', slow);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal((await b.engine.cancel('w')).value.status, 'cancelled');
  release();
  const out = await pending;
  assert.equal(out.value.status, 'cancelled');
  assert.equal((await b.engine.get('w')).stages[0].output, null);
  assert.equal((await b.engine.cancel('w')).ok, false);
});

test('interrupted runs are recoverable only after the lease expires; a live run blocks a second runner', async () => {
  const { engine, store } = setup();
  await engine.create({ id: 'w', objective: 'o' });
  const never = { requirements: passing('x', { execute: () => new Promise(() => {}) }) };
  void engine.advance('w', never, { timeoutMs: 300 }); // simulates a process that dies mid-stage
  await new Promise((r) => setTimeout(r, 10));
  assert.equal((await store.get('w')).stages[0].status, 'running');
  assert.equal((await engine.advance('w', handlersFor(PLAN))).error.code, 'INVALID_TRANSITION');
  assert.equal((await engine.recover('w')).value.stages[0].status, 'running'); // lease still valid
  tick += 1_000_000; // lease passes
  assert.equal((await engine.recover('w')).value.stages[0].status, 'pending');
  const r = await engine.advance('w', handlersFor(PLAN));
  assert.equal(r.value.status, 'awaiting-approval');
  assert.equal(r.value.stages[0].attempts, 2);
});

test('agent-backed stage handler: live contract validation, failures propagate, no fabricated result', async () => {
  const { engine } = setup();
  await engine.create({ id: 'w', objective: 'o' });
  const provider = new MockAgentProvider();
  const h = sdk.createAgentStageHandler(provider);
  const r = await engine.advance('w', { requirements: h, research: h, architecture: h, plan: h });
  assert.equal(r.value.status, 'awaiting-approval');
  assert.equal(r.value.stages[0].output, 'mock:plan');
  assert.match(r.value.stages[0].verification[1].evidence, /mock-agent/);

  await engine.create({ id: 'x', objective: 'o' });
  const none = sdk.createAgentStageHandler({ name: 'broken', execute: async () => ({ junk: true }) });
  const f = await engine.advance('x', { requirements: none });
  assert.equal(f.value.status, 'failed');
});

test('agent-proposed consequential actions are listed as unauthorized proposals only', async () => {
  const { engine } = setup();
  await engine.create({ id: 'w', objective: 'o' });
  const provider = new MockAgentProvider((req) => ({
    contractVersion: '1.0', taskId: req.id, status: 'completed', toolsUsed: [],
    output: { text: 'deploy', proposedActions: [{ id: 'a1', type: 'contract-deploy', description: 'deploy token', parameters: {} }] },
  }));
  const r = await engine.advance('w', { requirements: sdk.createAgentStageHandler(provider) });
  assert.match(r.value.stages[0].output, /proposal only; not authorized/);
  assert.equal(r.value.stages[0].approval, null);
});

test('D1 stores: workflow + audit chain survive a restart, CAS and concurrent appends hold', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'eureka-wf-'));
  const file = join(dir, 'state.db');
  try {
    let db = openD1Shim(file);
    assert.equal(new server.D1WorkflowStore(db).durable, true);
    let { engine } = setup({ store: new server.D1WorkflowStore(db), audit: new server.D1AuditLog(db) });
    await engine.create({ id: 'w', objective: 'o' });
    await engine.advance('w', handlersFor(PLAN));
    db.close();

    db = openD1Shim(file);
    const store = new server.D1WorkflowStore(db);
    const audit = new server.D1AuditLog(db);
    ({ engine } = setup({ store, audit }));
    const w = await engine.get('w');
    assert.equal(w.status, 'awaiting-approval');
    assert.equal((await store.update({ ...w, version: 99 }, 12345)), false);
    await Promise.all(Array.from({ length: 6 }, (_, i) => audit.append({ at: '2026-01-01T00:00:00.000Z', actor: 'p', action: 'x', subject: 'c', detail: { i } })));
    const entries = await audit.list();
    assert.equal(sdk.verifyAuditChain(entries).valid, true);
    assert.equal((await audit.list('c')).length, 6);
    await engine.approve('w', 'plan-approval', 'alice', sdk.reviewDigest(w, 'plan-approval'));
    assert.equal((await engine.get('w')).stages[4].status, 'approved');
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
