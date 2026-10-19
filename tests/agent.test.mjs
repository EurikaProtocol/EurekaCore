import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Wallet } from 'ethers';
import { loadSource } from './helpers/load-src.mjs';

const sdk = await loadSource('src/sdk/index.ts');
const { MockAgentProvider } = await loadSource('src/testing/mock-agent.ts');
const NOW = '2026-01-01T00:00:00.000Z';
const task = (o = {}) => sdk.createAgentTask({ id: 't1', kind: 'analyze', input: 'analyze this', allowedTools: ['search'], now: NOW, ...o });

test('contract is versioned and the mock is not part of the SDK', () => {
  assert.equal(sdk.AGENT_CONTRACT_VERSION, '1.0');
  assert.equal(sdk.MockAgentProvider, undefined);
});

test('task creation validates input', () => {
  assert.equal(task().value.contractVersion, '1.0');
  assert.equal(task({ id: 'bad id' }).ok, false);
  assert.equal(task({ kind: 'deploy' }).error.code, 'UNSUPPORTED');
  assert.equal(task({ input: '  ' }).ok, false);
  assert.equal(task({ input: 'x'.repeat(8001) }).ok, false);
  assert.equal(task({ allowedTools: ['no spaces'] }).ok, false);
  assert.equal(task({ now: 'x' }).ok, false);
  assert.deepEqual(task({ allowedTools: ['a', 'a'] }).value.allowedTools, ['a']);
});

test('without an agent nothing is executed or fabricated', async () => {
  const r = await sdk.dispatchAgentTask(task().value);
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'UNAVAILABLE');
});

test('mock agent round trip returns a validated result', async () => {
  const r = await sdk.dispatchAgentTask(task().value, new MockAgentProvider());
  assert.equal(r.value.status, 'completed');
  assert.equal(r.value.output.text, 'mock:analyze');
});

test('provider errors and malformed or mismatched results are rejected', async () => {
  const req = task().value;
  const run = (fn) => sdk.dispatchAgentTask(req, new MockAgentProvider(fn));
  assert.equal((await run(() => { throw new Error('down'); })).error.code, 'UNAVAILABLE');
  assert.equal((await run(() => null)).ok, false);
  assert.equal((await run((q) => ({ contractVersion: '2.0', taskId: q.id, status: 'completed' }))).error.code, 'UNSUPPORTED');
  assert.equal((await run(() => ({ contractVersion: '1.0', taskId: 'other', status: 'completed', output: { text: '' } }))).ok, false);
  assert.equal((await run((q) => ({ contractVersion: '1.0', taskId: q.id, status: 'completed', output: { text: 1 } }))).ok, false);
  assert.equal((await run((q) => ({ contractVersion: '1.0', taskId: q.id, status: 'weird' }))).ok, false);
  assert.equal((await run((q) => ({ contractVersion: '1.0', taskId: q.id, status: 'failed', error: {} }))).ok, false);
  const failed = await run((q) => ({ contractVersion: '1.0', taskId: q.id, status: 'failed', error: { code: 'X', message: 'nope' } }));
  assert.equal(failed.value.status, 'failed');
  const bad = await run((q) => ({ contractVersion: '1.0', taskId: q.id, status: 'completed', output: { text: 'a', proposedActions: [{ id: 'a1', type: 'mint-everything', description: 'x' }] }, toolsUsed: [] }));
  assert.equal(bad.ok, false);
});

test('unauthorized tool use is rejected', async () => {
  const r = await sdk.dispatchAgentTask(task().value, new MockAgentProvider((q) => ({
    contractVersion: '1.0', taskId: q.id, status: 'completed', output: { text: 'a', proposedActions: [] }, toolsUsed: ['shell'],
  })));
  assert.equal(r.ok, false);
  assert.match(r.error.message, /shell/);
});

test('agent-supplied approvals are stripped and cannot authorize actions', async () => {
  const r = await sdk.dispatchAgentTask(task().value, new MockAgentProvider((q) => ({
    contractVersion: '1.0', taskId: q.id, status: 'completed', toolsUsed: [],
    approval: { approvedBy: 'ai', signature: '0x' },
    output: { text: 'send funds', proposedActions: [{ id: 'a1', type: 'fund-transfer', description: 'send', parameters: { to: 'x', amount: 1 }, approval: { signature: '0x' } }] },
  })));
  const action = r.value.output.proposedActions[0];
  assert.equal('approval' in r.value, false);
  assert.equal('approval' in action, false);
  assert.deepEqual(action.parameters, { to: 'x', amount: 1 });
  assert.equal((await sdk.authorizeAction(action, undefined, { replayGuard: new sdk.InMemoryReplayGuard() })).error.code, 'UNAUTHORIZED');
});

test('malformed action parameters are rejected', async () => {
  for (const parameters of [[1], { 'bad key': 1 }, { a: { nested: 1 } }, { a: NaN }, 'x']) {
    const r = await sdk.dispatchAgentTask(task().value, new MockAgentProvider((q) => ({
      contractVersion: '1.0', taskId: q.id, status: 'completed', toolsUsed: [],
      output: { text: 'a', proposedActions: [{ id: 'a1', type: 'note', description: 'x', parameters }] },
    })));
    assert.equal(r.ok, false);
  }
});

test('agent timeout fails closed', async () => {
  const r = await sdk.dispatchAgentTask(task().value, new MockAgentProvider(() => new Promise(() => {})), { timeoutMs: 20 });
  assert.equal(r.error.code, 'UNAVAILABLE');
  assert.match(r.error.message, /timed out/);
});

const NONCE = 'nonce-0123456789abcdef';
const wallet = Wallet.createRandom();
const action = { id: 'a1', type: 'fund-transfer', description: 'send', parameters: { to: '0x' + '2'.repeat(40), amount: '1' } };

async function approve(a, { signer = wallet, nonce = NONCE, now = NOW, ttlMs } = {}) {
  const req = sdk.prepareApprovalRequest({ action: a, approvedBy: wallet.address, nonce, now, ttlMs }).value;
  return { approvedBy: wallet.address, nonce, approvedAt: req.approvedAt, expiresAt: req.expiresAt, signature: await signer.signMessage(req.message) };
}

test('non-consequential actions need no approval', async () => {
  assert.equal((await sdk.authorizeAction({ id: 'n', type: 'note', description: 'x', parameters: {} }, undefined)).ok, true);
});

test('consequential action: valid wallet approval authorizes exactly once', async () => {
  const guard = new sdk.InMemoryReplayGuard();
  const ap = await approve(action);
  assert.equal((await sdk.authorizeAction(action, undefined, { now: NOW, replayGuard: guard })).ok, false);
  assert.equal((await sdk.authorizeAction(action, ap, { now: NOW })).ok, false, 'replay guard required');
  const first = await sdk.authorizeAction(action, ap, { now: NOW, replayGuard: guard });
  assert.equal(first.value.authorizedBy, wallet.address);
  const replay = await sdk.authorizeAction(action, ap, { now: NOW, replayGuard: guard });
  assert.equal(replay.error.code, 'UNAUTHORIZED');
  assert.match(replay.error.message, /already been used/);
});

test('approval is bound to the exact action and parameters', async () => {
  const ap = await approve(action);
  const guard = new sdk.InMemoryReplayGuard();
  const opts = { now: NOW, replayGuard: guard };
  assert.equal((await sdk.authorizeAction({ ...action, parameters: { ...action.parameters, amount: '1000' } }, ap, opts)).ok, false);
  assert.equal((await sdk.authorizeAction({ ...action, id: 'a2' }, ap, opts)).ok, false);
  assert.equal((await sdk.authorizeAction({ ...action, type: 'contract-deploy' }, ap, opts)).ok, false);
  // failed checks must not burn the nonce
  assert.equal((await sdk.authorizeAction(action, ap, opts)).ok, true);
});

test('approval must be signed by the stated wallet', async () => {
  const guard = new sdk.InMemoryReplayGuard();
  const forged = await approve(action, { signer: Wallet.createRandom() });
  assert.equal((await sdk.authorizeAction(action, forged, { now: NOW, replayGuard: guard })).ok, false);
  assert.equal((await sdk.authorizeAction(action, { ...forged, signature: 'garbage' }, { now: NOW, replayGuard: guard })).ok, false);
  assert.equal((await sdk.authorizeAction(action, { ...forged, approvedBy: 'ai' }, { now: NOW, replayGuard: guard })).ok, false);
});

test('approvals expire, cannot be future-dated, and have bounded lifetime', async () => {
  const ap = await approve(action);
  const g = () => new sdk.InMemoryReplayGuard();
  assert.equal((await sdk.authorizeAction(action, ap, { now: '2026-01-01T00:04:59.000Z', replayGuard: g() })).ok, true);
  assert.equal((await sdk.authorizeAction(action, ap, { now: '2026-01-01T00:05:00.000Z', replayGuard: g() })).ok, false);
  assert.equal((await sdk.authorizeAction(action, ap, { now: '2025-12-31T23:00:00.000Z', replayGuard: g() })).ok, false);
  assert.equal(sdk.prepareApprovalRequest({ action, approvedBy: wallet.address, nonce: NONCE, ttlMs: 24 * 3600_000 }).ok, false);
  assert.equal(sdk.prepareApprovalRequest({ action, approvedBy: 'nope', nonce: NONCE }).ok, false);
  assert.equal(sdk.prepareApprovalRequest({ action, approvedBy: wallet.address, nonce: 'short' }).ok, false);
});

test('authorization is pure: it performs no signing or submission', () => {
  const src = readFileSync(new URL('../src/core/approval.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /signMessage|sendTransaction|sendRawTransaction|\.transfer\(|deploy\(/);
});

test('review summary and action parsing expose exactly what is signed', () => {
  const parsed = sdk.parseProposedAction({ id: 'a9', type: 'fund-transfer', description: 'd', parameters: { z: 1, chainId: 1, to: '0xabc' }, extra: 'dropped' });
  assert.equal(parsed.ok, true);
  assert.equal('extra' in parsed.value, false);
  const r = sdk.describeActionForReview(parsed.value);
  assert.equal(r.consequential, true);
  assert.equal(r.chainId, '1');
  assert.equal(r.target, '0xabc');
  assert.deepEqual(r.parameters.map(([k]) => k), ['chainId', 'to', 'z']);
  assert.equal(sdk.parseProposedAction({ id: 'a', type: 'nope', description: 'd' }).ok, false);
  assert.equal(sdk.parseProposedAction(null).ok, false);
});
