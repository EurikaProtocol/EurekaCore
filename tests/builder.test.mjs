import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './helpers/load-src.mjs';
import { makeFakeGitHub } from './helpers/worker-harness.mjs';

// UNIT + CONTRACT tests with in-memory fakes. Nothing here talks to a live TINAN AI or GitHub.
const sdk = await loadSource('src/sdk/index.ts');
const be = await loadSource('src/server/builder-executors.ts');
const ex = await loadSource('src/server/executors.ts');
const tb = await loadSource('src/server/tinanai-builder.ts');
const { MockAgentProvider } = await loadSource('src/testing/mock-agent.ts');
const { GitHubClient } = await loadSource('src/server/github.ts');
const api = await loadSource('src/server/api.ts');

const TID = '11111111-1111-4111-8111-111111111111';
const PID = '22222222-2222-4222-8222-222222222222';
const PLAN = { summary: 'A tiny site', technology: ['html'], features: ['home'], steps: ['write index'] };
const FILES = { 'index.html': '<h1>hi</h1>\n', 'src/app.js': 'export const a = 1;\n' };

let tick = 0;
const clockAt = (base) => () => new Date(base + tick++ * 1000).toISOString();

/** In-memory ProjectBuilderProvider. `s` is mutable so tests can model a misbehaving Builder. */
function fakeBuilder(over = {}) {
  const s = { status: 'planning', plan: PLAN, files: { ...FILES }, listed: null, projectId: null, cancelled: 0, approvals: 0, submits: 0, throwOn: {}, ...over };
  const view = () => ({ taskId: TID, status: s.status, requirements: s.requirements ?? 'req', projectId: s.projectId, plan: s.status === 'planning' ? null : s.plan, errors: s.errors ?? [] });
  const b = {
    name: 'fake-builder', contractVersion: '1.0', s,
    async submitRequirements(r) { s.submits++; s.requirements = r; return view(); },
    async getTask() { if (s.throwOn.getTask) throw new sdk.BuilderError('OWNERSHIP_MISMATCH', 'foreign'); if (s.status === 'planning') s.status = 'awaiting_approval'; return view(); },
    async forwardApproval() { s.approvals++; s.status = 'completed'; s.projectId = PID; return view(); },
    async listFiles() { return s.listed ?? Object.keys(s.files); },
    async readFile(_p, path) { if (typeof s.files[path] !== 'string') throw new sdk.BuilderError('NOT_FOUND', 'nf'); return s.files[path]; },
    async cancel() { s.cancelled++; },
  };
  return b;
}

function setup({ builder: b0 = undefined, noBuilder = false, github = true, sandbox, base = Date.UTC(2026, 0, 1) } = {}) {
  const builder = noBuilder ? undefined : (b0 ?? fakeBuilder());
  const audit = new sdk.InMemoryAuditLog();
  const store = new sdk.InMemoryWorkflowStore();
  const registry = sdk.createDefaultRegistry();
  const gh = makeFakeGitHub();
  const client = github ? new GitHubClient({ token: 'tok', allowedRepos: ['EurikaProtocol/TinanAi'], fetch: (u, i) => gh.handle(new Request(u, i)) }) : undefined;
  const engine = new sdk.WorkflowEngine(store, audit, registry, clockAt(base));
  const handlers = be.createBuilderDeliveryHandlers({ registry, builder, github: client, sandbox, pollIntervalMs: 1, sleep: async () => {} });
  return { engine, audit, store, registry, builder, gh, handlers, client };
}
const mk = (e, id = 'w1', objective = 'build a tiny site') => e.create({ id, objective, productId: 'tinan-ai', grantedLevel: 3, pipeline: 'builder-delivery-v1' }, 'alice@example.com');
const stage = (w, id) => w.stages.find((x) => x.id === id);
const digestOf = (w, gate) => sdk.reviewDigest(w, gate);

async function toPlanGate(t) {
  await mk(t.engine);
  const r = await t.engine.advance('w1', t.handlers);
  assert.equal(r.value.status, 'awaiting-approval', r.value.reason);
  return r.value;
}
async function approve(t, gate, who = 'alice@example.com') {
  const w = (await t.store.get('w1'));
  return t.engine.approve('w1', gate, who, digestOf(w, gate));
}
async function toFilesGate(t) {
  await toPlanGate(t);
  assert.ok((await approve(t, 'plan-approval')).ok);
  const r = await t.engine.advance('w1', t.handlers);
  assert.equal(r.value.status, 'awaiting-approval', r.value.reason);
  return r.value;
}

// ---- plan vs source distinction -------------------------------------------------------------------------------------

test('the agent planning provider is not a generation provider: plan summaries never become generated files', async () => {
  const filesInSummary = JSON.stringify({ files: [{ path: 'generated/w1/a.test.mjs', content: 'x' }] });
  // The legacy executor module no longer parses agent summaries as source files at all.
  assert.equal(ex.parseGeneratedFiles, undefined);
  const provider = new MockAgentProvider((r) => ({ contractVersion: '1.0', taskId: r.id, status: 'completed', output: { text: filesInSummary, proposedActions: [] }, toolsUsed: [] }));
  const registry = sdk.createDefaultRegistry();
  const h = ex.createPrDeliveryHandlers({ registry, provider });
  assert.deepEqual(Object.keys(h).sort(), ['architecture', 'requirements']);
  assert.equal(h.generation, undefined);
});

test('pr-delivery-v1 blocks at generation with an explicit message; no files, branch or PR', async () => {
  const t = setup();
  await t.engine.create({ id: 'w1', objective: 'x', productId: 'tinan-ai', grantedLevel: 3, pipeline: 'pr-delivery-v1' });
  const provider = new MockAgentProvider((r) => ({ contractVersion: '1.0', taskId: r.id, status: 'completed', output: { text: JSON.stringify({ files: [{ path: 'generated/w1/a.test.mjs', content: 'x' }] }), proposedActions: [] }, toolsUsed: [] }));
  const handlers = ex.createPrDeliveryHandlers({ registry: t.registry, provider });
  const unavailable = ex.PR_DELIVERY_UNAVAILABLE;
  let w = (await t.engine.advance('w1', handlers, { unavailable })).value;
  for (let i = 0; i < 4 && w.status === 'awaiting-approval'; i++) {
    const gate = w.stages.find((s) => s.status === 'awaiting-approval').id;
    await t.engine.approve('w1', gate, 'alice@example.com', digestOf(w, gate));
    w = (await t.engine.advance('w1', handlers, { unavailable })).value;
  }
  assert.equal(w.status, 'blocked');
  assert.match(w.reason, /generation/);
  assert.equal(t.gh.mutations.length, 0);
  assert.equal(t.gh.prs.length, 0);
});

// ---- missing provider ------------------------------------------------------------------------------------------------

test('without a Builder no generation handler exists and the workflow blocks with a configuration message', async () => {
  const t = setup({ noBuilder: true });
  assert.deepEqual(Object.keys(t.handlers).sort(), ['branch', 'pull-request']);
  await mk(t.engine);
  const msg = api.builderUnavailable({ builder: undefined, github: t.client, sandbox: undefined });
  assert.match(msg['builder-submit'], /TINANAI_BUILDER_ENABLED/);
  const r = await t.engine.advance('w1', t.handlers, { unavailable: msg });
  assert.equal(r.value.status, 'blocked');
  assert.match(r.value.reason, /TINANAI_BUILDER_ENABLED/);
  assert.equal(t.gh.mutations.length, 0);
  assert.equal(t.gh.prs.length, 0);
});

test('without GitHub the commit stage is not registered; without a sandbox there is no testing handler', async () => {
  assert.equal(setup({ github: false }).handlers.commit, undefined);
  assert.equal(setup().handlers.testing, undefined);
  assert.ok(setup({ sandbox: { run: async () => ({}) } }).handlers.testing);
  const m = api.builderUnavailable({ builder: fakeBuilder(), github: undefined, sandbox: undefined });
  assert.ok(m.commit || m.branch);
  assert.ok(m.testing);
});

// ---- happy path to the sandbox gate; no simulated success ------------------------------------------------------------

test('full proposal path commits the approved files, reads them back, then blocks at testing with no sandbox and opens no PR', async () => {
  const t = setup();
  await toFilesGate(t);
  assert.equal(t.builder.s.approvals, 1);
  assert.ok((await approve(t, 'files-approval')).ok);
  const r = await t.engine.advance('w1', t.handlers, { unavailable: { testing: 'No verified sandbox is configured.' } });
  assert.equal(r.value.status, 'blocked');
  assert.equal(r.value.stages.find((s) => s.id === 'testing').status, 'pending');
  assert.equal(stage(r.value, 'commit').status, 'completed');
  const committed = [...t.gh.files.keys()];
  assert.equal(committed.length, 2);
  assert.ok(committed.every((k) => k.startsWith('eureka/')));
  assert.equal(t.gh.prs.length, 0, 'no pull request may claim success without passing sandbox tests');
  assert.match(r.value.reason, /sandbox/i);
});

// ---- plan digest / approvals -----------------------------------------------------------------------------------------

test('a changed objective, plan or file manifest changes the digest and invalidates the old approval', async () => {
  const t = setup();
  const w0 = await toPlanGate(t);
  const d = digestOf(w0, 'plan-approval');
  const w1 = structuredClone(w0);
  w1.objective = 'something else';
  assert.notEqual(digestOf(w1, 'plan-approval'), d);
  const w2 = structuredClone(w0);
  const o = JSON.parse(stage(w2, 'builder-plan').output);
  o.plan.steps.push('rm -rf');
  stage(w2, 'builder-plan').output = JSON.stringify(o);
  assert.notEqual(digestOf(w2, 'plan-approval'), d);
  assert.equal((await t.engine.approve('w1', 'plan-approval', 'alice@example.com', digestOf(w2, 'plan-approval'))).ok, false);
  assert.equal((await t.engine.approve('w1', 'plan-approval', 'alice@example.com', '0xdead')).ok, false);

  const t2 = setup();
  const g0 = await toFilesGate(t2);
  const g1 = structuredClone(g0);
  const m = JSON.parse(stage(g1, 'builder-generation').output);
  m.files[0].sha256 = '0x' + 'ab'.repeat(32);
  stage(g1, 'builder-generation').output = JSON.stringify(m);
  assert.notEqual(digestOf(g1, 'files-approval'), digestOf(g0, 'files-approval'));
});

test('plan changed in the Builder after approval: nothing is generated or committed', async () => {
  const t = setup();
  await toPlanGate(t);
  await approve(t, 'plan-approval');
  t.builder.s.plan = { ...PLAN, steps: ['exfiltrate'] };
  const r = await t.engine.advance('w1', t.handlers);
  assert.notEqual(r.value.status, 'awaiting-approval');
  assert.match(r.value.stages.find((s) => s.id === 'builder-generation').error ?? r.value.reason, /no longer matches/);
  assert.equal(t.builder.s.approvals, 0, 'approval must not be forwarded for a plan nobody approved');
  assert.equal(t.gh.mutations.length, 0);
});

test('a Builder task that advanced on its own (self-approved) is refused', async () => {
  const t = setup({ builder: fakeBuilder({ status: 'generating' }) });
  await mk(t.engine);
  const r = await t.engine.advance('w1', t.handlers);
  assert.notEqual(r.value.status, 'awaiting-approval');
  assert.match(JSON.stringify(r.value.stages.map((s) => s.error)) + r.value.reason, /before EurekaCore approval/);
});

test('rejected approval cancels the workflow, forwards nothing and is audited', async () => {
  const t = setup();
  await toPlanGate(t);
  const r = await t.engine.reject('w1', 'plan-approval', 'alice@example.com', 'not what I asked');
  assert.equal(r.value.status, 'cancelled');
  assert.equal((await t.engine.advance('w1', t.handlers)).value.status, 'cancelled');
  assert.equal(t.builder.s.approvals, 0);
  assert.ok((await t.audit.list()).some((e) => e.action === 'stage.rejected'));
});

test('approvals expire, cannot be replayed, cannot be self-issued, and are audited with the human and digest', async () => {
  const t = setup();
  const w = await toPlanGate(t);
  const d = digestOf(w, 'plan-approval');
  assert.equal((await t.engine.approve('w1', 'plan-approval', 'orchestrator', d)).error.code, 'UNAUTHORIZED');
  assert.equal((await t.engine.approve('w1', 'plan-approval', '', d)).error.code, 'UNAUTHORIZED');
  assert.ok((await t.engine.approve('w1', 'plan-approval', 'alice@example.com', d)).ok);
  assert.equal((await t.engine.approve('w1', 'plan-approval', 'alice@example.com', d)).ok, false, 'single use');
  const rec = (await t.audit.list()).find((e) => e.action === 'stage.approved');
  assert.equal(rec.actor, 'alice@example.com');
  assert.equal(rec.detail.digest, d);

  // Expiry: gate is opened at the engine clock, then time jumps past the TTL.
  let now = Date.UTC(2026, 0, 1);
  const t2 = setup();
  t2.engine.clock = () => new Date(now).toISOString();
  await mk(t2.engine);
  const w2 = (await t2.engine.advance('w1', t2.handlers)).value;
  const d2 = digestOf(w2, 'plan-approval');
  now += sdk.APPROVAL_TTL_MS + 1000;
  const late = await t2.engine.approve('w1', 'plan-approval', 'alice@example.com', d2);
  assert.equal(late.ok, false);
  assert.equal(late.error.code, 'UNAUTHORIZED');
  assert.equal(t2.builder.s.approvals, 0);
});

test('generation cannot run before the human approval of the exact plan (needsApproval enforced)', async () => {
  const t = setup();
  await toPlanGate(t);
  const r = await t.engine.advance('w1', t.handlers);
  assert.equal(r.value.status, 'awaiting-approval');
  assert.equal(t.builder.s.approvals, 0);
  assert.equal(stage(r.value, 'builder-generation').status, 'pending');
});

// ---- file validation -------------------------------------------------------------------------------------------------

test('file paths: traversal, absolute, hidden/workflow, backslash, duplicate (incl. case) and counts are rejected', () => {
  for (const bad of ['../x.js', 'a/../../x.js', '/etc/passwd', 'a\\b.js', '.github/workflows/a.yml', '.env', 'a//b.js', '', 'a/./b.js', 'x\0.js']) {
    assert.throws(() => be.validateBuilderPaths([bad]), undefined, `should reject ${JSON.stringify(bad)}`);
  }
  assert.throws(() => be.validateBuilderPaths(['a.js', 'a.js']), /Duplicate/);
  assert.throws(() => be.validateBuilderPaths(['A.js', 'a.js']), /Duplicate/);
  assert.throws(() => be.validateBuilderPaths([]));
  assert.throws(() => be.validateBuilderPaths(Array.from({ length: sdk.MAX_BUILDER_FILES + 1 }, (_, i) => `f${i}.js`)));
  assert.deepEqual(be.validateBuilderPaths(['src/a.js', 'b.html']), ['src/a.js', 'b.html']);
});

test('file contents: oversized, total-oversized, malformed and non-string content are rejected', () => {
  assert.throws(() => be.buildManifest([{ path: 'a.js', content: 'x'.repeat(sdk.MAX_BUILDER_FILE_BYTES + 1) }]), /too large/);
  const per = sdk.MAX_BUILDER_FILE_BYTES;
  assert.throws(() => be.buildManifest([0, 1, 2].map((i) => ({ path: `f${i}.js`, content: 'x'.repeat(per) }))), /in total/);
  assert.throws(() => be.buildManifest([{ path: 'a.js', content: 'a\0b' }]));
  assert.throws(() => be.buildManifest([{ path: 'a.js', content: 42 }]));
  assert.throws(() => be.buildManifest([{ path: '../a.js', content: 'x' }]));
  const m = be.buildManifest([{ path: 'a.js', content: 'héllo' }]);
  assert.equal(m[0].bytes, 6);
  assert.match(m[0].sha256, /^0x[0-9a-f]{64}$/);
});

test('invalid generation responses fail the stage: traversal, duplicates, oversized, too many, missing files', async () => {
  const cases = [
    { listed: ['../evil.js'], files: { '../evil.js': 'x' } },
    { listed: ['a.js', 'A.js'], files: { 'a.js': 'x', 'A.js': 'y' } },
    { listed: ['big.js'], files: { 'big.js': 'x'.repeat(sdk.MAX_BUILDER_FILE_BYTES + 1) } },
    { listed: Array.from({ length: 25 }, (_, i) => `f${i}.js`), files: {} },
    { listed: [], files: {} },
    { listed: ['ghost.js'], files: {} },
  ];
  for (const c of cases) {
    const t = setup({ builder: fakeBuilder({ listed: c.listed, files: c.files }) });
    await toPlanGate(t);
    await approve(t, 'plan-approval');
    const r = await t.engine.advance('w1', t.handlers);
    assert.notEqual(r.value.status, 'awaiting-approval', JSON.stringify(c.listed).slice(0, 60));
    assert.equal(stage(r.value, 'files-approval').status, 'pending');
    assert.equal(t.gh.mutations.length, 0);
    assert.equal(t.gh.prs.length, 0);
  }
});

test('manifest tampering is detected on re-read', () => {
  const entries = be.buildManifest([{ path: 'a.js', content: 'x' }]);
  const pd = '0x' + '11'.repeat(32);
  const ok = { taskId: TID, projectId: PID, planDigest: pd, files: entries, manifestDigest: sdk.manifestDigest(pd, entries) };
  assert.equal(be.parseManifest(ok).files.length, 1);
  assert.throws(() => be.parseManifest({ ...ok, files: [{ ...entries[0], sha256: '0x' + '00'.repeat(32) }] }), /digest/);
  assert.throws(() => be.parseManifest({ ...ok, files: [{ ...entries[0], path: '../a.js' }] }));
  assert.throws(() => be.parseManifest({ ...ok, files: 'nope' }));
});

// ---- ownership -------------------------------------------------------------------------------------------------------

test('ownership mismatch stops the workflow before any approval or write', async () => {
  const t = setup({ builder: fakeBuilder({ throwOn: { getTask: true } }) });
  await mk(t.engine);
  const r = await t.engine.advance('w1', t.handlers);
  assert.notEqual(r.value.status, 'awaiting-approval');
  assert.equal(t.gh.mutations.length, 0);
});

const OWNER = tb.deriveServiceOwnerId('svc');
const rec = (over = {}) => ({ task: { id: TID, ownerId: OWNER, kind: 'project', projectId: null, requirements: 'req', plan: PLAN, status: 'awaiting_approval', progress: 50, errors: [], ...over } });
const jr = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
function adapter(handler) {
  const calls = [];
  const p = new tb.TinanAiBuilderProvider({ baseUrl: 'https://tinan.example.com', username: 'svc', password: 'p'.repeat(40), fetch: async (u, i) => { calls.push({ u: String(u), i }); return handler(String(u), i); } });
  return { p, calls };
}

test('adapter contract: ownership of tasks and projects is enforced; foreign ids are refused', async () => {
  const { p } = adapter(() => jr(rec({ ownerId: 'f'.repeat(64) })));
  await assert.rejects(p.getTask(TID), (e) => e.code === 'OWNERSHIP_MISMATCH');
  const q = adapter((u) => (u.endsWith(PID) ? jr({ project: { id: PID, ownerId: 'e'.repeat(64), files: ['a.js'] } }) : jr({}, 404))).p;
  await assert.rejects(q.listFiles(PID), (e) => e.code === 'OWNERSHIP_MISMATCH');
  const swap = adapter(() => jr(rec({ id: '99999999-9999-4999-8999-999999999999' }))).p;
  await assert.rejects(swap.getTask(TID), (e) => e.code === 'OWNERSHIP_MISMATCH');
  const ok = adapter(() => jr(rec())).p;
  assert.equal((await ok.getTask(TID)).status, 'awaiting_approval');
});

test('adapter contract: wire format, Origin on POST, no overwrite fields, approval is only a trigger, bounded responses', async () => {
  const { p, calls } = adapter((u, i) => (i.method === 'POST' && u.endsWith('/approval') ? jr(rec({ status: 'generating' })) : jr(rec({ projectId: null }))));
  await p.submitRequirements('make a site');
  await p.forwardApproval(TID);
  const [submit, approve] = calls;
  assert.equal(new URL(submit.u).pathname, '/api/projects');
  assert.equal(submit.i.headers.Origin, 'https://tinan.example.com');
  assert.deepEqual(JSON.parse(submit.i.body), { requirements: 'make a site' });
  assert.deepEqual(JSON.parse(approve.i.body), { approved: true });
  assert.ok(String(submit.i.headers.Authorization).startsWith('Basic '));
  await assert.rejects(p.submitRequirements(''), (e) => e.code === 'INVALID_INPUT');
  await assert.rejects(p.submitRequirements('x'.repeat(sdk.MAX_BUILDER_REQUIREMENTS + 1)), (e) => e.code === 'INVALID_INPUT');
  await assert.rejects(p.getTask('../etc'), (e) => e.code === 'INVALID_INPUT');
  const big = adapter(() => new Response('x'.repeat(300 * 1024))).p;
  await assert.rejects(big.getTask(TID), (e) => e.code === 'MALFORMED');
  const bogus = adapter(() => jr({ task: { id: TID, ownerId: OWNER, status: 'weird', requirements: 'r' } })).p;
  await assert.rejects(bogus.getTask(TID), (e) => e.code === 'MALFORMED');
  const file = adapter(() => jr({ path: 'other.js', content: 'x' })).p;
  await assert.rejects(file.readFile(PID, 'a.js'), (e) => e.code === 'MALFORMED');
  const auth = adapter(() => new Response('', { status: 401 })).p;
  await assert.rejects(auth.getTask(TID), (e) => e.code === 'AUTH');
});

test('credentials never appear in errors', async () => {
  const { p } = adapter(() => { throw new Error('connect failed for ' + 'p'.repeat(40)); });
  await assert.rejects(p.getTask(TID), (e) => !String(e.message).includes('p'.repeat(40)));
});

// ---- GitHub restrictions and read-back -------------------------------------------------------------------------------

test('GitHub restrictions: allowlist, eureka/* branches only, no default-branch writes', async () => {
  const gh = makeFakeGitHub();
  const c = new GitHubClient({ token: 'tok', allowedRepos: ['EurikaProtocol/TinanAi'], fetch: (u, i) => gh.handle(new Request(u, i)) });
  const repo = { owner: 'EurikaProtocol', name: 'TinanAi' };
  await assert.rejects(c.putFile(repo, 'main', 'a.js', 'x', 'm'));
  await assert.rejects(c.putFile(repo, 'feature/x', 'a.js', 'x', 'm'));
  await assert.rejects(c.createBranch(repo, 'main'));
  await assert.rejects(c.createBranch({ owner: 'Evil', name: 'Repo' }, 'eureka/x'));
  await assert.rejects(c.putFile(repo, 'eureka/x', '../a.js', 'x', 'm'));
  assert.equal(gh.mutations.length, 0);
  assert.equal(typeof c.merge, 'undefined');
  assert.equal(typeof c.deleteBranch, 'undefined');
  assert.equal(typeof c.forcePush, 'undefined');
});

test('failed GitHub read-back fails commit verification', async () => {
  const t = setup();
  await toFilesGate(t);
  await approve(t, 'files-approval');
  // Corrupt what GitHub returns after the write.
  const orig = t.gh.handle;
  t.gh.handle = async (req) => {
    const res = await orig(req);
    if (req.method === 'GET' && /\/contents\//.test(req.url) && res.status === 200) {
      const b = await res.json();
      return new Response(JSON.stringify({ ...b, content: Buffer.from('tampered').toString('base64') }), { status: 200 });
    }
    return res;
  };
  const r = await t.engine.advance('w1', t.handlers, { unavailable: { testing: 'x' } });
  assert.notEqual(stage(r.value, 'commit').status, 'completed');
  assert.equal(t.gh.prs.length, 0);
});

test('Builder content that differs from the approved manifest is never committed', async () => {
  const t = setup();
  await toFilesGate(t);
  await approve(t, 'files-approval');
  t.builder.s.files['index.html'] = '<script>steal()</script>';
  const r = await t.engine.advance('w1', t.handlers, { unavailable: { testing: 'x' } });
  assert.notEqual(stage(r.value, 'commit').status, 'completed');
  assert.ok([...t.gh.files.keys()].every((k) => !k.includes('index.html')));
  assert.equal(t.gh.prs.length, 0);
});

// ---- cancellation ----------------------------------------------------------------------------------------------------

test('cancellation: the Builder task is cancelled best-effort and no GitHub side effect follows', async () => {
  const t = setup();
  await toFilesGate(t);
  await approve(t, 'files-approval');
  await t.engine.cancel('w1', 'alice@example.com');
  const r = await t.engine.advance('w1', t.handlers);
  assert.equal(r.value.status, 'cancelled');
  assert.equal(t.gh.mutations.length, 0);

  const t2 = setup();
  await mk(t2.engine);
  const h = t2.handlers['builder-plan'];
  const ctx = { workflowId: 'w1', objective: 'o', productId: 'tinan-ai', stage: {}, previous: { 'builder-submit': JSON.stringify({ taskId: TID }) }, signal: new AbortController().signal, isCancelled: async () => true };
  await assert.rejects(h.execute(ctx), /Cancelled/);
  assert.equal(t2.builder.s.cancelled, 1);
  const actor = (await t.audit.list()).find((e) => e.action === 'workflow.cancelled' || e.action === 'workflow.cancel');
  assert.ok(!actor || actor.actor === 'alice@example.com');
});

// ---- permission levels / no simulated success ------------------------------------------------------------------------

test('six permission levels preserved; levels 5-6 are never autonomous; generation stage is level 3', () => {
  assert.deepEqual(Object.keys(sdk.PERMISSION_LEVELS ?? { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 }).length, 6);
  assert.equal(sdk.isAutonomouslyPermitted(5, 6), false);
  assert.equal(sdk.isAutonomouslyPermitted(6, 6), false);
  const gen = sdk.BUILDER_DELIVERY_PIPELINE.find((s) => s.id === 'builder-generation');
  assert.equal(gen.level, 3);
  assert.equal(gen.needsApproval, 'plan-approval');
  assert.ok(sdk.BUILDER_DELIVERY_PIPELINE.every((s) => s.level <= 3));
});

test('no pull request without passing sandbox tests: a sandbox that reports zero tests blocks the PR', async () => {
  const sandbox = { async run() { return { exitCode: 0, stdout: '# pass 0\n# fail 0\n', stderr: '', durationMs: 1, timedOut: false, isolation: { network: 'none', readOnlyRoot: true, cpus: 1, memoryMb: 256, runner: 'fake' } }; } };
  const t = setup({ sandbox });
  await toFilesGate(t);
  await approve(t, 'files-approval');
  const r = await t.engine.advance('w1', t.handlers);
  assert.notEqual(stage(r.value, 'testing').status, 'completed');
  assert.equal(t.gh.prs.length, 0);
});
