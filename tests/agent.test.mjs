import assert from 'node:assert/strict';
import test from 'node:test';
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
    approval: { actionId: 'a1', approvedBy: 'ai', method: 'wallet-confirmation', expiresAt: '2999-01-01T00:00:00Z' },
    output: { text: 'send funds', proposedActions: [{ id: 'a1', type: 'fund-transfer', description: 'send', approval: { actionId: 'a1' } }] },
  })));
  const action = r.value.output.proposedActions[0];
  assert.equal('approval' in r.value, false);
  assert.equal('approval' in action, false);
  assert.equal(sdk.authorizeAction(action).error.code, 'UNAUTHORIZED');
});

test('consequential actions need a matching, unexpired human approval', () => {
  const note = { id: 'n1', type: 'note', description: 'fyi' };
  assert.equal(sdk.authorizeAction(note).ok, true);
  for (const type of ['blockchain-transaction', 'contract-deploy', 'fund-transfer', 'permission-change']) {
    const a = { id: 'a1', type, description: 'x' };
    assert.equal(sdk.isConsequential(type), true);
    assert.equal(sdk.authorizeAction(a, undefined, NOW).error.code, 'UNAUTHORIZED');
    const approval = sdk.createHumanApproval({ actionId: 'a1', approvedBy: '0xUser', now: NOW }).value;
    assert.equal(sdk.authorizeAction(a, approval, NOW).value.authorizedBy, '0xUser');
    assert.equal(sdk.authorizeAction({ ...a, id: 'a2' }, approval, NOW).ok, false);
    assert.equal(sdk.authorizeAction(a, approval, '2026-01-01T00:05:00.000Z').ok, false);
    assert.equal(sdk.authorizeAction(a, { ...approval, method: 'ai' }, NOW).ok, false);
  }
  assert.equal(sdk.createHumanApproval({ actionId: '', approvedBy: 'u' }).ok, false);
  assert.equal(sdk.createHumanApproval({ actionId: 'a', approvedBy: '' }).ok, false);
  assert.equal(sdk.createHumanApproval({ actionId: 'a', approvedBy: 'u', ttlMs: 24 * 3600_000 }).ok, false);
});
