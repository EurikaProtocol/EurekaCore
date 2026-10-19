import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Wallet } from 'ethers';
import { loadSource } from './helpers/load-src.mjs';
import { openD1Shim } from './helpers/d1-shim.mjs';

const sdk = await loadSource('src/sdk/index.ts');
const server = await loadSource('src/server/d1.ts');
const { MockAgentProvider } = await loadSource('src/testing/mock-agent.ts');
const NOW = '2026-01-01T00:00:00.000Z';
const req = (id = 't1') => sdk.createAgentTask({ id, kind: 'plan', input: 'plan it', now: NOW }).value;

test('in-memory implementations never claim durability; D1 ones do', () => {
  assert.equal(new sdk.InMemoryTaskStore().durable, false);
  assert.equal(new sdk.InMemoryReplayGuard().durable, false);
  const db = openD1Shim();
  assert.equal(new server.D1TaskStore(db).durable, true);
  assert.equal(new server.D1ReplayGuard(db).durable, true);
});

test('task state survives a restart (reopened database file)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'eureka-d1-'));
  const file = join(dir, 'state.db');
  try {
    let db = openD1Shim(file);
    let mgr = new sdk.TaskManager(new server.D1TaskStore(db));
    await mgr.submit(req('done'));
    await mgr.run('done', new MockAgentProvider());
    await mgr.submit(req('cancelled'));
    await mgr.cancel('cancelled');
    await mgr.submit(req('queued'));
    db.close();

    db = openD1Shim(file);
    mgr = new sdk.TaskManager(new server.D1TaskStore(db));
    assert.equal((await mgr.get('done')).status, 'completed');
    assert.equal((await mgr.get('done')).result.output.text, 'mock:plan');
    assert.equal((await mgr.get('cancelled')).status, 'cancelled');
    assert.equal((await mgr.cancel('cancelled')).error.code, 'INVALID_TRANSITION');
    assert.equal((await mgr.run('done', new MockAgentProvider())).error.code, 'INVALID_TRANSITION');
    assert.equal((await mgr.get('queued')).status, 'queued');
    assert.equal((await mgr.submit(req('done'))).ok, false, 'duplicate id rejected after restart');
    assert.equal((await new server.D1TaskStore(db).list()).length, 3);
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('concurrent duplicate submits: exactly one wins', async () => {
  const db = openD1Shim();
  const mgr = new sdk.TaskManager(new server.D1TaskStore(db));
  const results = await Promise.all(Array.from({ length: 10 }, () => mgr.submit(req())));
  assert.equal(results.filter((r) => r.ok).length, 1);
});

test('concurrent cancel and completion: compare-and-set yields one terminal state', async () => {
  const db = openD1Shim();
  const store = new server.D1TaskStore(db);
  const mgr = new sdk.TaskManager(store);
  await mgr.submit(req());
  const rec = await store.get('t1');
  const a = { ...rec, status: 'cancelled' };
  const b = { ...rec, status: 'completed' };
  const [x, y] = await Promise.all([store.update(a, 'queued'), store.update(b, 'queued')]);
  assert.equal([x, y].filter(Boolean).length, 1);
  assert.ok(['cancelled', 'completed'].includes((await store.get('t1')).status));
});

const wallet = Wallet.createRandom();
const action = { id: 'a1', type: 'fund-transfer', description: 'send', parameters: { amount: '1' } };
async function approval(nonce) {
  const r = sdk.prepareApprovalRequest({ action, approvedBy: wallet.address, nonce, now: NOW }).value;
  return { approvedBy: wallet.address, nonce, approvedAt: r.approvedAt, expiresAt: r.expiresAt, signature: await wallet.signMessage(r.message) };
}

test('approval nonce: 25 concurrent authorizations, exactly one succeeds', async () => {
  const guard = new server.D1ReplayGuard(openD1Shim());
  const ap = await approval('nonce-concurrent-0001');
  const results = await Promise.all(Array.from({ length: 25 }, () => sdk.authorizeAction(action, ap, { now: NOW, replayGuard: guard })));
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(results.filter((r) => !r.ok && r.error.code === 'UNAUTHORIZED').length, 24);
});

test('approval replay is rejected after a restart (durable guard)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'eureka-d1-'));
  const file = join(dir, 'state.db');
  try {
    const ap = await approval('nonce-restart-00001');
    let db = openD1Shim(file);
    assert.equal((await sdk.authorizeAction(action, ap, { now: NOW, replayGuard: new server.D1ReplayGuard(db) })).ok, true);
    db.close();
    db = openD1Shim(file);
    const again = await sdk.authorizeAction(action, ap, { now: NOW, replayGuard: new server.D1ReplayGuard(db) });
    assert.match(again.error.message, /already been used/);
    // the in-memory guard would have allowed the replay
    assert.equal((await sdk.authorizeAction(action, ap, { now: NOW, replayGuard: new sdk.InMemoryReplayGuard() })).ok, true);
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('expired approvals are rejected without consuming the nonce; purge removes only expired records', async () => {
  const db = openD1Shim();
  const guard = new server.D1ReplayGuard(db, () => NOW);
  const ap = await approval('nonce-expiry-000001');
  assert.equal((await sdk.authorizeAction(action, ap, { now: '2026-01-01T00:10:00.000Z', replayGuard: guard })).ok, false);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM approval_nonces').get().n, 0);
  await guard.consume('old', '2026-01-01T00:05:00.000Z');
  await guard.consume('fresh', '2026-01-02T00:00:00.000Z');
  assert.equal(await guard.purgeExpired('2026-01-01T12:00:00.000Z'), 1);
  assert.equal(await guard.consume('fresh', '2026-01-02T00:00:00.000Z'), false);
});

test('storage failure fails closed', async () => {
  const guard = new server.D1ReplayGuard(openD1Shim(':memory:', { failWrites: true }));
  const ap = await approval('nonce-failure-00001');
  const r = await sdk.authorizeAction(action, ap, { now: NOW, replayGuard: guard });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'UNAVAILABLE');
  const mgr = new sdk.TaskManager(new server.D1TaskStore(openD1Shim(':memory:', { failWrites: true })));
  await assert.rejects(mgr.submit(req()), /D1 unavailable/);
});

test('D1 adapter refuses to continue if row counts are not reported', async () => {
  const bad = { prepare: () => ({ bind() { return this; }, run: async () => ({}), first: async () => null, all: async () => ({}) }) };
  await assert.rejects(new server.D1ReplayGuard(bad).consume('n', NOW), /did not report/);
});
