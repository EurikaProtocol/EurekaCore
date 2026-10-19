import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './helpers/load-src.mjs';

// CONTRACT TESTS against a fake fetch modelled on TinanAi's source (c329cafe). They do NOT prove a live TinanAi works.
const sdk = await loadSource('src/sdk/index.ts');
const t = await loadSource('src/server/tinanai-provider.ts');
const BASE = 'https://tinan.example.com';
const req = (o = {}) => sdk.createAgentTask({ id: 't1', kind: 'plan', input: 'build a plan', allowedTools: ['read-file'], now: '2026-01-01T00:00:00.000Z', ...o }).value;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const remote = (o = {}) => ({ id: 'r1', status: 'completed', summary: 'Done', selectedTools: [], toolResults: [], plan: [], errors: [], ...o });
const sleep = async () => {};

function provider(handler, extra = {}) {
  const calls = [];
  const fetch = async (url, init) => { calls.push({ url, init }); return handler(url, init, calls); };
  return { calls, p: new t.TinanAiProvider({ baseUrl: BASE, username: 'user', password: 'p'.repeat(40), fetch, sleep, ...extra }) };
}
const run = (p, request = req(), signal) => sdk.dispatchAgentTask(request, p, { signal });

test('config validation: required, https-only, no embedded credentials', () => {
  assert.throws(() => t.parseTinanAiConfig({ TINANAI_BASE_URL: 'http://tinan.example.com', TINANAI_USERNAME: 'u', TINANAI_PASSWORD: 'p' }), /HTTPS/);
  assert.throws(() => t.parseTinanAiConfig({}), /server-side secrets/);
  const embedded = 'https://' + 'user:pw' + '@tinan.example.com';
  assert.throws(() => t.parseTinanAiConfig({ TINANAI_BASE_URL: embedded, TINANAI_USERNAME: 'u', TINANAI_PASSWORD: 'p' }), /embed credentials/);
  assert.equal(t.parseTinanAiConfig({ TINANAI_BASE_URL: 'http://localhost:3000/x', TINANAI_USERNAME: 'u', TINANAI_PASSWORD: 'p' }).baseUrl, 'http://localhost:3000');
});

test('submits the documented request: Basic auth, same Origin, objective only', async () => {
  const { p, calls } = provider(() => json({ task: remote() }, 202));
  const r = await run(p);
  assert.equal(r.value.status, 'completed');
  assert.equal(r.value.output.text, 'Done');
  const { url, init } = calls[0];
  assert.equal(url, `${BASE}/api/agent/tasks`);
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.Origin, BASE);
  assert.match(init.headers.Authorization, /^Basic /);
  assert.deepEqual(JSON.parse(init.body), { objective: 'build a plan' });
  assert.equal(init.redirect, 'error');
});

test('polls until a terminal state', async () => {
  const seq = ['planning', 'executing', 'completed'];
  const { p, calls } = provider((url, init) => json({ task: remote({ status: init.method === 'POST' ? 'planning' : seq.shift() }) }));
  const r = await run(p);
  assert.equal(r.value.status, 'completed');
  assert.equal(calls.filter((c) => c.init.method === 'GET').length, 3);
  assert.equal(calls[1].url, `${BASE}/api/agent/tasks/r1`);
});

test('maps tools and plan steps; plan steps are non-consequential notes', async () => {
  const { p } = provider(() => json({ task: remote({
    toolResults: [{ tool: 'read-file', status: 'completed', summary: 's' }],
    plan: [{ id: 's1', title: 'Deploy', description: 'to prod', permission: 'PRODUCTION', tool: null }],
  }) }));
  const r = await run(p);
  assert.deepEqual(r.value.toolsUsed, ['read-file']);
  assert.equal(r.value.output.proposedActions[0].type, 'note');
  assert.equal((await sdk.authorizeAction(r.value.output.proposedActions[0], undefined)).ok, true);
});

test('a tool outside allowedTools is rejected by EurekaCore validation', async () => {
  const { p } = provider(() => json({ task: remote({ toolResults: [{ tool: 'shell' }] }) }));
  const r = await run(p);
  assert.equal(r.ok, false);
  assert.match(r.error.message, /shell/);
});

test('TinanAi-side approval is never granted: no /approval call, reported as failed', async () => {
  const { p, calls } = provider(() => json({ task: remote({ status: 'awaiting_approval' }) }));
  const r = await run(p);
  assert.equal(r.value.status, 'failed');
  assert.equal(r.value.error.code, 'TINANAI_APPROVAL_REQUIRED');
  assert.equal(calls.some((c) => c.url.includes('/approval')), false);
});

test('provider failures are surfaced, never replaced by mock results', async () => {
  const cases = [
    [() => json({ error: 'x' }, 401), 'AUTH'],
    [() => json({ error: 'x' }, 403), 'AUTH'],
    [() => json({ error: 'x' }, 429), 'RATE_LIMITED'],
    [() => json({ error: 'x' }, 404), 'NOT_FOUND'],
    [() => json({ error: 'x' }, 503), 'UNAVAILABLE'],
    [() => json({ error: 'x' }, 500), 'HTTP'],
    [() => new Response('<html>', { status: 200 }), 'MALFORMED'],
    [() => json({ nope: 1 }), 'MALFORMED'],
    [() => json({ task: remote({ status: 'mystery' }) }), 'MALFORMED'],
    [() => json({ task: remote({ summary: undefined }) }), 'MALFORMED'],
    [() => { throw new TypeError('fetch failed'); }, 'NETWORK'],
    [() => json({ task: remote({ status: 'failed', errors: ['bad'] }) }), 'TINANAI_FAILED'],
    [() => json({ task: remote({ status: 'cancelled' }) }), 'CANCELLED'],
  ];
  for (const [h, code] of cases) {
    const { p } = provider(h);
    const r = await run(p);
    assert.equal(r.value?.status, 'failed', code);
    assert.equal(r.value.error.code, code);
    assert.equal(r.value.output, undefined);
  }
});

test('oversized objective and oversized response are rejected', async () => {
  const { p, calls } = provider(() => json({ task: remote() }));
  assert.equal((await run(p, req({ input: 'x'.repeat(2001) }))).value.error.code, 'INPUT_TOO_LONG');
  assert.equal(calls.length, 0);
  const big = provider(() => new Response('{"task":"' + 'a'.repeat(300) + '"}'), { maxResponseBytes: 100 });
  assert.equal((await run(big.p)).value.error.code, 'MALFORMED');
});

test('abort (timeout or cancellation) cancels the remote task and stops polling', async () => {
  const ctrl = new AbortController();
  let polls = 0;
  const { p, calls } = provider((url, init) => {
    if (url.endsWith('/cancel')) return json({ task: remote({ status: 'cancelled' }) });
    if (init.method === 'GET') { polls += 1; ctrl.abort(); }
    return json({ task: remote({ status: 'planning' }) });
  }, { sleep: async (_ms, signal) => { if (signal?.aborted) throw new t.TinanAiError('ABORTED', 'x'); } });
  const r = await run(p, req(), ctrl.signal);
  assert.equal(r.ok, false);
  assert.ok(calls.some((c) => c.url === `${BASE}/api/agent/tasks/r1/cancel` && c.init.method === 'POST'));
  assert.ok(polls <= 1);
});

test('TaskManager.cancel aborts a running remote task', async () => {
  const mgr = new sdk.TaskManager(new sdk.InMemoryTaskStore());
  await mgr.submit(req());
  const { p, calls } = provider((url, init) => {
    if (url.endsWith('/cancel')) return json({ task: remote({ status: 'cancelled' }) });
    return json({ task: remote({ status: 'planning' }) });
  }, { sleep: (_ms, signal) => new Promise((_, rej) => signal?.addEventListener('abort', () => rej(new t.TinanAiError('ABORTED', 'x')))) });
  const running = mgr.run('t1', p);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal((await mgr.cancel('t1')).value.status, 'cancelled');
  assert.equal((await running).value.status, 'cancelled');
  assert.ok(calls.some((c) => c.url.endsWith('/cancel')));
});

test('credentials never appear in results or errors', async () => {
  const { p } = provider(() => json({ error: 'x' }, 401));
  const r = await run(p);
  assert.doesNotMatch(JSON.stringify(r), /pppppppp|Basic /);
});

test('provider module is not bundled into the browser build', async () => {
  const { readFileSync } = await import('node:fs');
  for (const f of ['src/sdk/index.ts', 'src/core/index.ts', 'src/App.tsx', 'src/main.tsx']) {
    assert.doesNotMatch(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'), /server\/tinanai-provider|server\/d1/);
  }
});
