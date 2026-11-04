import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { loadSource } from './helpers/load-src.mjs';

const gh = await loadSource('src/server/github.ts');
const sb = await loadSource('src/server/sandbox.ts');
const ex = await loadSource('src/server/executors.ts');
const { DockerSandboxRunner } = await loadSource('src/sandbox/docker-runner.ts');

const dockerUp = spawnSync('docker', ['image', 'inspect', 'node:22-alpine'], { stdio: 'ignore' }).status === 0;

const recorder = (respond) => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(init.body) : null, headers: init?.headers });
    return respond(String(url), init);
  };
  return { calls, fetch };
};
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
const client = (fetch, repos = ['Owner/Repo']) => new gh.GitHubClient({ token: 'tok_secret_value', allowedRepos: repos, fetch });
const ref = { owner: 'Owner', name: 'Repo' };

test('github: repositories outside the allowlist are refused before any request', async () => {
  const r = recorder(() => json({}));
  await assert.rejects(client(r.fetch).getRepo({ owner: 'evil', name: 'repo' }), { code: 'FORBIDDEN' });
  assert.equal(r.calls.length, 0);
});

test('github: writes only to eureka/ branches and safe paths; the default branch is protected', async () => {
  const r = recorder((url) => (url.endsWith('/repos/Owner/Repo') ? json({ default_branch: 'main', private: false, full_name: 'Owner/Repo', archived: false }) : json({})));
  const c = client(r.fetch);
  await assert.rejects(c.putFile(ref, 'main', 'generated/a.js', 'x', 'm'), { code: 'FORBIDDEN' });
  await assert.rejects(c.putFile(ref, 'feature/x', 'generated/a.js', 'x', 'm'), { code: 'FORBIDDEN' });
  for (const bad of ['../etc/passwd', '/abs', '.github/workflows/x.yml', 'a//b', 'a/../b']) {
    await assert.rejects(c.putFile(ref, 'eureka/ok', bad, 'x', 'm'), { code: 'FORBIDDEN' }, bad);
  }
  await assert.rejects(c.createBranch(ref, 'main'), { code: 'FORBIDDEN' });
  assert.equal(r.calls.filter((x) => x.method !== 'GET').length, 0);
});

test('github: exposes no merge, delete or force operations', () => {
  const names = Object.getOwnPropertyNames(gh.GitHubClient.prototype).join(' ').toLowerCase();
  for (const forbidden of ['merge', 'delete', 'force', 'remove']) assert.ok(!names.includes(forbidden), forbidden);
});

test('github: errors never contain the token; upstream failures are typed', async () => {
  const r = recorder(() => new Response('denied tok_secret_value', { status: 403 }));
  const err = await client(r.fetch).getRepo(ref).catch((e) => e);
  assert.equal(err.code, 'UPSTREAM');
  assert.ok(!String(err.message).includes('tok_secret_value'));
  const net = await client(async () => { throw new TypeError('connect tok_secret_value'); }).getRepo(ref).catch((e) => e);
  assert.ok(!String(net.message).includes('tok_secret_value'));
});

test('github: createBranch is idempotent and the PR is always a draft', async () => {
  const state = { refs: { main: 'sha-main' } };
  const r = recorder((url, init) => {
    const m = init?.method ?? 'GET';
    if (url.endsWith('/repos/Owner/Repo')) return json({ default_branch: 'main', private: false, full_name: 'Owner/Repo', archived: false });
    const head = /git\/ref\/heads\/(.+)$/.exec(url);
    if (head) return state.refs[head[1]] ? json({ object: { sha: state.refs[head[1]] } }) : json({}, 404);
    if (m === 'POST' && url.endsWith('/git/refs')) { const b = JSON.parse(init.body); state.refs[b.ref.replace('refs/heads/', '')] = b.sha; return json({ object: { sha: b.sha } }, 201); }
    if (m === 'POST' && url.endsWith('/pulls')) return json({ number: 7, html_url: 'https://github.com/Owner/Repo/pull/7', draft: true, state: 'open', merged: false }, 201);
    return json({}, 500);
  });
  const c = client(r.fetch);
  assert.equal((await c.createBranch(ref, 'eureka/t1')).created, true);
  assert.equal((await c.createBranch(ref, 'eureka/t1')).created, false);
  await c.createDraftPullRequest(ref, 'eureka/t1', 't', 'b');
  const pr = r.calls.find((x) => x.url.endsWith('/pulls'));
  assert.equal(pr.body.draft, true);
  assert.equal(pr.body.base, 'main');
  assert.ok(!r.calls.some((x) => x.method === 'DELETE' || x.method === 'PATCH' || /merge/.test(x.url)));
});

test('sandbox: request validation rejects unknown commands, unsafe paths and oversize input', () => {
  const ok = { command: 'node-test', timeoutMs: 5000, files: [{ path: 'a.test.mjs', content: 'x' }] };
  sb.validateSandboxRequest(ok);
  for (const bad of [
    { ...ok, command: 'sh' }, { ...ok, timeoutMs: 10 }, { ...ok, timeoutMs: 10 ** 9 }, { ...ok, files: [] },
    { ...ok, files: [{ path: '../x.js', content: '' }] }, { ...ok, files: [{ path: '/etc/x', content: '' }] },
    { ...ok, files: [{ path: 'a.js', content: 'x'.repeat(sb.MAX_SANDBOX_BYTES + 1) }] },
  ]) assert.throws(() => sb.validateSandboxRequest(bad));
});

test('sandbox: remote client authenticates, validates results and fails on bad responses', async () => {
  const good = { exitCode: 0, timedOut: false, stdout: 'ok', stderr: '', durationMs: 5, isolation: { runner: 'docker', network: 'none', readOnlyRoot: true } };
  const r = recorder(() => json(good));
  const c = new sb.RemoteSandboxClient({ url: 'https://sbx.example', token: 't'.repeat(32), fetch: r.fetch });
  const out = await c.run({ command: 'node-test', timeoutMs: 5000, files: [{ path: 'a.test.mjs', content: 'x' }] });
  assert.equal(out.exitCode, 0);
  assert.ok(String(r.calls[0].headers.Authorization ?? r.calls[0].headers.authorization).startsWith('Bearer '));
  const bad = new sb.RemoteSandboxClient({ url: 'https://sbx.example', token: 't'.repeat(32), fetch: async () => json({ exitCode: 'zero' }) });
  await assert.rejects(bad.run({ command: 'node-test', timeoutMs: 5000, files: [{ path: 'a.test.mjs', content: 'x' }] }));
  assert.throws(() => sb.parseSandboxConfig({ SANDBOX_URL: 'http://insecure.example', SANDBOX_TOKEN: 't'.repeat(32) }));
});

test('docker sandbox: real container has no network, cannot write the mount, and is killed on timeout', { skip: !dockerUp && 'docker image node:22-alpine unavailable' }, async () => {
  const runner = new DockerSandboxRunner();
  const file = (content) => [{ path: 'a.test.mjs', content: `import test from 'node:test';import assert from 'node:assert';import fs from 'node:fs';import net from 'node:net';\n${content}` }];
  const net = await runner.run({ command: 'node-test', timeoutMs: 30_000, files: file(`test('no network', async () => { await assert.rejects(new Promise((res, rej) => { const s = net.connect(443, '1.1.1.1'); s.on('connect', res); s.on('error', rej); setTimeout(() => rej(new Error('timeout')), 3000); })); });`) });
  assert.equal(net.exitCode, 0, net.stdout + net.stderr);
  assert.equal(net.isolation.network, 'none');
  const ro = await runner.run({ command: 'node-test', timeoutMs: 30_000, files: file(`test('read-only mount', () => { assert.throws(() => fs.writeFileSync('/work/x.txt', 'x')); });`) });
  assert.equal(ro.exitCode, 0, ro.stdout + ro.stderr);
  const slow = await runner.run({ command: 'node-test', timeoutMs: 3000, files: file(`test('spin', () => { for (;;); });`) });
  assert.equal(slow.timedOut, true);
  assert.equal(slow.exitCode, null);
  const left = spawnSync('docker', ['ps', '-q', '--filter', 'name=eureka-sbx-']).stdout.toString().trim();
  assert.equal(left, '', 'no sandbox container may survive a timeout');
});

test('live GitHub (read-only, opt-in via EUREKA_LIVE_GITHUB=1 and GH_TOKEN)', { skip: !(process.env.EUREKA_LIVE_GITHUB === '1' && process.env.GH_TOKEN) && 'live test not enabled' }, async () => {
  const c = new gh.GitHubClient({ token: process.env.GH_TOKEN, allowedRepos: ['EurikaProtocol/EurekaCore'] });
  const info = await c.getRepo({ owner: 'EurikaProtocol', name: 'EurekaCore' });
  assert.equal(info.fullName, 'EurikaProtocol/EurekaCore');
  assert.ok(await c.getBranchSha({ owner: 'EurikaProtocol', name: 'EurekaCore' }, info.defaultBranch));
});
