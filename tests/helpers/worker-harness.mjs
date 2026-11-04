import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';
import { loadSource } from './load-src.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const ORIGIN = 'https://eureka.test';
export const TEAM = 'test.cloudflareaccess.com';
export const AUD = 'aud-123';
const b64u = (b) => Buffer.from(b).toString('base64url');

/** Real RS256 key pair; the Worker verifies tokens against this key set fetched through its (intercepted) outbound fetch. */
export async function makeIdentityProvider() {
  const mk = () => crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const good = await mk();
  const other = await mk();
  const jwk = { ...(await crypto.subtle.exportKey('jwk', good.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const sign = async (email, { key = good, aud = AUD, iss = `https://${TEAM}`, exp = Math.floor(Date.now() / 1000) + 600, kid = 'k1' } = {}) => {
    const head = b64u(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
    const body = b64u(JSON.stringify({ email, aud: [aud], iss, exp, iat: Math.floor(Date.now() / 1000) }));
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key.privateKey, new TextEncoder().encode(`${head}.${body}`));
    return `${head}.${body}.${b64u(sig)}`;
  };
  return { jwks: { keys: [jwk] }, sign, otherKey: other };
}

/** Stateful GitHub stand-in that records every mutating call. Contract-level fake, NOT GitHub. */
export function makeFakeGitHub({ repo = 'EurikaProtocol/TinanAi', defaultBranch = 'main' } = {}) {
  const state = { refs: new Map([[defaultBranch, 'a'.repeat(40)]]), files: new Map(), prs: [], mutations: [], auth: new Set(), commits: 0 };
  const j = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
  state.handle = async (req) => {
    const u = new URL(req.url);
    state.auth.add(req.headers.get('authorization'));
    const p = u.pathname;
    const base = `/repos/${repo}`;
    if (!p.startsWith(base)) return j({ message: 'Not Found' }, 404);
    const rest = p.slice(base.length);
    if (req.method !== 'GET') state.mutations.push({ method: req.method, rest, body: await req.clone().json().catch(() => null) });
    if (req.method === 'GET' && rest === '') return j({ default_branch: defaultBranch, private: false, full_name: repo, archived: false });
    let m;
    if (req.method === 'GET' && (m = /^\/git\/ref\/heads\/(.+)$/.exec(rest))) {
      const sha = state.refs.get(decodeURIComponent(m[1]));
      return sha ? j({ object: { sha } }) : j({ message: 'Not Found' }, 404);
    }
    if (req.method === 'POST' && rest === '/git/refs') {
      const b = await req.json();
      state.refs.set(b.ref.replace('refs/heads/', ''), b.sha);
      return j({ object: { sha: b.sha } }, 201);
    }
    if ((m = /^\/contents\/(.+)$/.exec(rest))) {
      const path = decodeURIComponent(m[1]);
      const branch = u.searchParams.get('ref') ?? (await req.clone().json().catch(() => ({}))).branch;
      const key = `${branch}:${path}`;
      if (req.method === 'GET') return state.files.has(key) ? j({ sha: 'f'.repeat(40), encoding: 'base64', content: Buffer.from(state.files.get(key)).toString('base64') }) : j({ message: 'Not Found' }, 404);
      if (req.method === 'PUT') {
        const b = await req.json();
        if (state.files.has(key) && !b.sha) return j({ message: 'sha required' }, 422);
        state.files.set(key, Buffer.from(b.content, 'base64').toString('utf8'));
        state.commits++;
        const sha = String(state.commits).padStart(40, 'c');
        state.refs.set(b.branch, sha);
        return j({ commit: { sha } }, 201);
      }
    }
    if (req.method === 'POST' && rest === '/pulls') {
      const b = await req.json();
      state.prs.push({ number: state.prs.length + 1, ...b, merged: false, state: 'open' });
      return j({ number: state.prs.length, html_url: `https://github.com/${repo}/pull/${state.prs.length}`, draft: b.draft }, 201);
    }
    if (req.method === 'GET' && (m = /^\/pulls\/(\d+)$/.exec(rest))) {
      const pr = state.prs[Number(m[1]) - 1];
      return pr ? j({ number: pr.number, state: pr.state, merged: pr.merged, draft: pr.draft, html_url: `https://github.com/${repo}/pull/${pr.number}`, head: { ref: pr.head } }) : j({}, 404);
    }
    return j({ message: 'Not Found' }, 404);
  };
  return state;
}

export const GOOD_FILES = (prefix, { failing = false } = {}) => ({
  files: [
    { path: `${prefix}sum.mjs`, content: 'export const sum = (a, b) => a + b;\n' },
    { path: `${prefix}sum.test.mjs`, content: `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { sum } from './sum.mjs';\ntest('sum', () => assert.equal(sum(2, 2), ${failing ? 5 : 4}));\n` },
  ],
});

/** TinanAi stand-in with the documented task API. NOT a live TinanAi. `mode.fail` forces provider errors. */
export function makeFakeTinan(mode = {}) {
  const calls = [];
  const handle = async (req) => {
    const body = await req.json().catch(() => ({}));
    calls.push(body.objective);
    if (mode.fail) return new Response('boom', { status: mode.fail });
    if (mode.delayMs) await new Promise((r) => setTimeout(r, mode.delayMs));
    const m = /"path":"(generated\/[^<"]+)<file>"/.exec(body.objective ?? '');
    const summary = m ? JSON.stringify(GOOD_FILES(m[1], { failing: mode.failingTests })) : `analysis of: ${String(body.objective).slice(0, 40)}`;
    return new Response(JSON.stringify({ task: { id: 'r1', status: 'completed', summary, toolResults: [], plan: [], errors: [] } }), { status: 202, headers: { 'content-type': 'application/json' } });
  };
  return { calls, handle, mode };
}


export const BUILDER_TASK_ID = '11111111-1111-4111-8111-111111111111';
export const BUILDER_PROJECT_ID = '22222222-2222-4222-8222-222222222222';
export const BUILDER_PLAN = { summary: 'A tiny sum utility', technology: ['node'], features: ['sum'], steps: ['write sum.mjs', 'write sum.test.mjs'] };
export const BUILDER_FILES = ({ failing = false } = {}) => ({
  'sum.mjs': 'export const sum = (a, b) => a + b;\n',
  'sum.test.mjs': `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { sum } from './sum.mjs';\ntest('sum', () => assert.equal(sum(2, 2), ${failing ? 5 : 4}));\n`,
});

/**
 * TINAN AI Builder stand-in modelled on TinanAi's project routes (task record, files listed by path, one file per request).
 * Contract fake, NOT a live TINAN AI. It rejects non-GET requests whose Origin is not its own, like TinanAi's proxy.
 */
export function makeFakeBuilder(mode = {}) {
  const state = { status: null, requirements: null, calls: [], approvals: 0, cancels: 0, files: mode.files ?? BUILDER_FILES({ failing: mode.failingTests }), mode };
  const ownerId = mode.ownerId ?? createHash('sha256').update('svc').digest('hex');
  const j = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
  const task = () => ({ id: BUILDER_TASK_ID, ownerId, kind: 'project', projectId: state.status === 'completed' ? BUILDER_PROJECT_ID : null, requirements: state.requirements, plan: state.status === 'planning' ? null : (state.mode.plan ?? BUILDER_PLAN), status: state.status, progress: 0, errors: [] });
  state.handle = async (req) => {
    const u = new URL(req.url);
    state.calls.push(`${req.method} ${u.pathname}`);
    if (!req.headers.get('authorization')?.startsWith('Basic ')) return j({ error: 'auth' }, 401);
    if (req.method !== 'GET' && req.headers.get('origin') !== 'https://tinan.test') return j({ error: 'origin' }, 403);
    const p = u.pathname;
    if (req.method === 'POST' && p === '/api/projects') { const b = await req.json(); state.requirements = b.requirements; state.status = 'planning'; return j({ task: task() }, 202); }
    if (req.method === 'GET' && p === `/api/projects/tasks/${BUILDER_TASK_ID}`) { if (state.status === 'planning') state.status = 'awaiting_approval'; return j({ task: task() }); }
    if (req.method === 'POST' && p === `/api/projects/tasks/${BUILDER_TASK_ID}/approval`) {
      const b = await req.json();
      if (b.approved !== true || state.status !== 'awaiting_approval') return j({ error: 'state' }, 409);
      state.approvals++; state.status = 'completed'; return j({ task: task() }, 202);
    }
    if (req.method === 'POST' && p === `/api/projects/tasks/${BUILDER_TASK_ID}/cancel`) { state.cancels++; state.status = 'cancelled'; return j({ task: task() }); }
    if (req.method === 'GET' && p === `/api/projects/${BUILDER_PROJECT_ID}`) return j({ project: { id: BUILDER_PROJECT_ID, ownerId, files: Object.keys(state.files) } });
    if (req.method === 'GET' && p === `/api/projects/${BUILDER_PROJECT_ID}/files`) {
      const path = u.searchParams.get('path');
      return typeof state.files[path] === 'string' ? j({ path, content: state.files[path] }) : j({ error: 'nf' }, 404);
    }
    return j({ error: 'not found' }, 404);
  };
  return state;
}

export async function startWorker({ persist, idp, github, tinan, builder, sandboxRunner, extraBindings = {}, authConfigured = true }) {
  const outdir = mkdtempSync(join(tmpdir(), 'eureka-assets-'));
  const outfile = bundleWorker();
  const mf = new Miniflare({
    d1Persist: join(persist, 'v3/d1'),
    workers: [{
    name: 'eureka',
    modules: true,
    scriptPath: outfile,
    modulesRoot: dirname(outfile),
    compatibilityDate: '2026-08-01',
    compatibilityFlags: ['nodejs_compat'],
    d1Databases: { DB: '00000000-0000-0000-0000-000000000000' },
    serviceBindings: { ASSETS: async () => new Response('static asset stub', { status: 200 }) },
    bindings: {
      ...(authConfigured ? { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD } : {}),
      EUREKA_VIEWERS: 'viewer@x.test', EUREKA_OPERATORS: 'op@x.test', EUREKA_APPROVERS: 'alice@x.test',
      TINANAI_BASE_URL: 'https://tinan.test', TINANAI_USERNAME: 'svc', TINANAI_PASSWORD: 'p'.repeat(40),
      GITHUB_TOKEN: 'ghp_faketesttoken', GITHUB_ALLOWED_REPOS: 'EurikaProtocol/TinanAi',
      SANDBOX_URL: 'https://sandbox.test', SANDBOX_TOKEN: 's'.repeat(32), ...extraBindings,
    },
    outboundService: async (req) => {
      const u = new URL(req.url);
      if (u.hostname === TEAM) return new Response(JSON.stringify(idp.jwks), { headers: { 'content-type': 'application/json' } });
      if (u.hostname === 'api.github.com') return github.handle(req);
      if (u.hostname === 'tinan.test') return builder && u.pathname.startsWith('/api/projects') ? builder.handle(req) : tinan.handle(req);
      if (u.hostname === 'sandbox.test') {
        if (req.headers.get('authorization') !== 'Bearer ' + 's'.repeat(32)) return new Response('no', { status: 401 });
        return new Response(JSON.stringify(await sandboxRunner.run(await req.json())), { headers: { 'content-type': 'application/json' } });
      }
      return new Response('blocked', { status: 502 });
    },
    }],
  });
  await mf.ready;
  const call = async (method, path, { token, body, origin = ORIGIN, headers = {} } = {}) => {
    const res = await mf.dispatchFetch(`${ORIGIN}${path}`, {
      method,
      headers: { ...(token ? { 'Cf-Access-Jwt-Assertion': token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' && origin ? { Origin: origin } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (res.status === 500 && process.env.DEBUG_WORKER) console.error('WORKER 500:', text.slice(0, 500));
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* non-JSON body */ }
    return { status: res.status, body: parsed };
  };
  return { mf, call, dispose: async () => { await mf.dispose(); rmSync(outdir, { recursive: true, force: true }); } };
}

let bundled;
/** The exact artifact `wrangler deploy` would upload (dry run), so tests run the production bundle. */
export function bundleWorker() {
  if (bundled) return bundled;
  const out = mkdtempSync(join(tmpdir(), 'eureka-bundle-'));
  execFileSync('npx', ['wrangler', 'deploy', '--dry-run', '--config', join(root, 'wrangler.toml'), '--outdir', out], { cwd: root, stdio: 'pipe' });
  return (bundled = join(out, 'worker.js'));
}

export function migrate(persist) {
  execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist, '--config', join(root, 'wrangler.test.toml')], { cwd: root, stdio: 'pipe' });
}
export { loadSource };
