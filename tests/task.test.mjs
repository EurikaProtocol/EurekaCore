import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './helpers/load-src.mjs';

const sdk = await loadSource('src/sdk/index.ts');
const { MockAgentProvider } = await loadSource('src/testing/mock-agent.ts');

let tick = 0;
const clock = () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString();
const req = (id = 't1') => sdk.createAgentTask({ id, kind: 'plan', input: 'make a plan', allowedTools: ['search'], now: '2026-01-01T00:00:00.000Z' }).value;
const setup = () => { tick = 0; const store = new sdk.InMemoryTaskStore(); return { store, mgr: new sdk.TaskManager(store, clock) }; };

test('submit creates a queued task and rejects duplicates', async () => {
  const { mgr } = setup();
  const r = await mgr.submit(req());
  assert.equal(r.value.status, 'queued');
  assert.equal((await mgr.submit(req())).ok, false);
  assert.equal(await mgr.get('missing'), null);
});

test('run completes with a validated result and records history', async () => {
  const { mgr } = setup();
  await mgr.submit(req());
  const r = await mgr.run('t1', new MockAgentProvider());
  assert.equal(r.value.status, 'completed');
  assert.equal(r.value.result.output.text, 'mock:plan');
  assert.deepEqual(r.value.history.map((h) => h.status), ['queued', 'running', 'completed']);
});

test('terminal tasks cannot be re-run or cancelled; unknown tasks error', async () => {
  const { mgr } = setup();
  await mgr.submit(req());
  await mgr.run('t1', new MockAgentProvider());
  assert.equal((await mgr.run('t1', new MockAgentProvider())).error.code, 'INVALID_TRANSITION');
  assert.equal((await mgr.cancel('t1')).error.code, 'INVALID_TRANSITION');
  assert.equal((await mgr.cancel('nope')).ok, false);
  for (const s of ['completed', 'failed', 'cancelled']) assert.equal(sdk.isTerminal(s), true);
  assert.equal(sdk.isTerminal('queued'), false);
});

test('queued task can be cancelled and then cannot run', async () => {
  const { mgr } = setup();
  await mgr.submit(req());
  assert.equal((await mgr.cancel('t1')).value.status, 'cancelled');
  assert.equal((await mgr.run('t1', new MockAgentProvider())).error.code, 'INVALID_TRANSITION');
});

test('cancellation while running discards the late result', async () => {
  const { mgr } = setup();
  await mgr.submit(req());
  let release;
  const provider = new MockAgentProvider((q) => new Promise((res) => { release = () => res({ contractVersion: '1.0', taskId: q.id, status: 'completed', output: { text: 'late', proposedActions: [] }, toolsUsed: [] }); }));
  const running = mgr.run('t1', provider);
  await new Promise((r) => setImmediate(r));
  assert.equal((await mgr.cancel('t1')).value.status, 'cancelled');
  release();
  const done = await running;
  assert.equal(done.value.status, 'cancelled');
  assert.equal((await mgr.get('t1')).result, null);
});

test('failures: no provider, provider error, invalid output, agent-reported failure, timeout', async () => {
  const cases = [
    [undefined, /No AI agent/],
    [new MockAgentProvider(() => { throw new Error('boom'); }), /boom/],
    [new MockAgentProvider(() => ({ nonsense: true })), /version/],
    [new MockAgentProvider((q) => ({ contractVersion: '1.0', taskId: q.id, status: 'failed', error: { code: 'LIMIT', message: 'too big' } })), /LIMIT: too big/],
    [new MockAgentProvider(() => new Promise(() => {})), /timed out/],
  ];
  for (const [provider, pattern] of cases) {
    const { mgr } = setup();
    await mgr.submit(req());
    const r = await mgr.run('t1', provider, { timeoutMs: 20 });
    assert.equal(r.value.status, 'failed');
    assert.match(r.value.error, pattern);
  }
});

test('unauthorized tool use fails the task without storing the result', async () => {
  const { mgr } = setup();
  await mgr.submit(req());
  const r = await mgr.run('t1', new MockAgentProvider((q) => ({ contractVersion: '1.0', taskId: q.id, status: 'completed', output: { text: 'a', proposedActions: [] }, toolsUsed: ['shell'] })));
  assert.equal(r.value.status, 'failed');
  assert.equal(r.value.result, null);
});

test('store compare-and-set rejects stale updates and returns copies', async () => {
  const { store, mgr } = setup();
  await mgr.submit(req());
  const rec = await store.get('t1');
  rec.status = 'completed';
  assert.equal((await store.get('t1')).status, 'queued', 'mutating a returned copy does not change the store');
  assert.equal(await store.update(rec, 'running'), false);
  assert.equal(await store.update(rec, 'queued'), true);
  assert.equal((await store.list()).length, 1);
});
