import type { AgentProvider } from '../core/agent';
import type { ProjectBuilderProvider } from '../core/builder';
import { MAX_AUTONOMOUS_LEVEL, isPermissionLevel } from '../core/permissions';
import { createDefaultRegistry, type ProductRegistry } from '../core/registry';
import { PIPELINES, WorkflowEngine, pipelineOf, reviewDigest, type PipelineId, type StageHandler, type WorkflowRecord } from '../core/workflow';
import type { CoreError } from '../core/errors';
import { authenticate, type AuthEnv, type Identity, type Role } from './auth';
import { D1AuditLog, D1WorkflowStore, type D1DatabaseLike } from './d1';
import { createBuilderDeliveryHandlers } from './builder-executors';
import { PR_DELIVERY_UNAVAILABLE, createPrDeliveryHandlers } from './executors';
import { GitHubClient, parseGitHubConfig, parseRepo } from './github';
import { verifySchema } from './schema';
import { RemoteSandboxClient, parseSandboxConfig, type SandboxRunner } from './sandbox';
import { BuilderApiError, BuilderProjectService, D1BuilderProjectStore, PROJECT_ID, type BuilderClient } from './builder-service';
import { TinanAiBuilderProvider, delegationSubjectFor } from './tinanai-builder';
import { TINANAI_MAX_OBJECTIVE, TinanAiProvider, parseTinanAiConfig } from './tinanai-provider';

export type ApiEnv = AuthEnv & {
  DB?: D1DatabaseLike;
  TINANAI_BASE_URL?: string; TINANAI_USERNAME?: string; TINANAI_PASSWORD?: string;
  /** Must be exactly "true" to register the TINAN AI Builder generation handlers (operator attestation that the contract was verified). */
  TINANAI_BUILDER_ENABLED?: string;
  GITHUB_TOKEN?: string; GITHUB_ALLOWED_REPOS?: string;
  SANDBOX_URL?: string; SANDBOX_TOKEN?: string;
  /**
   * Optional per-user delegation secret (>= 32 chars, distinct from TINANAI_PASSWORD). When set, EurekaCore signs a short-lived
   * `x-eureka-delegation` for the verified user so TINAN AI isolates owners itself (needs TINAN_MULTI_USER_ENABLED=true there).
   */
  TINANAI_DELEGATION_SECRET?: string;
  /** Optional Cloudflare Service Binding to the TINAN AI Worker (private Worker-to-Worker transport). Absent => authenticated HTTPS. */
  TINANAI_SERVICE?: { fetch: typeof fetch };
};

export type Services = {
  engine: WorkflowEngine;
  registry: ProductRegistry;
  handlers: Record<string, Record<string, StageHandler>>;
  github?: GitHubClient;
  provider?: AgentProvider;
  /** Project-generation provider; deliberately separate from `provider` (agent planning). */
  builder?: ProjectBuilderProvider;
  sandbox?: SandboxRunner;
  db?: D1DatabaseLike;
  /** Native Builder workspace (projects, approval, verified files). Absent unless the Builder is enabled and configured. */
  builderProjects?: BuilderProjectService;
  /** Per pipeline: why a stage has no handler. Appended to the engine's block message. */
  unavailable?: Record<string, Record<string, string>>;
};

export type ApiOverrides = { fetch?: typeof fetch; now?: () => number; services?: Services };

const MAX_BODY = 16_384;
const WRITE_LIMIT = 30;
const WINDOW_MS = 60_000;
const writeHits = new Map<string, number[]>();

/** Best-effort per-isolate limiter for writes by verified identity; edge-wide limits belong in Cloudflare rate-limiting rules. */
function limited(email: string, now: number): boolean {
  const hits = (writeHits.get(email) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= WRITE_LIMIT) { writeHits.set(email, hits); return true; }
  hits.push(now);
  writeHits.set(email, hits);
  if (writeHits.size > 1000) for (const [k, v] of writeHits) if (v.every((t) => now - t >= WINDOW_MS)) writeHits.delete(k);
  return false;
}

/** Builds services from server-side bindings only. Missing configuration means the capability is absent; nothing is mocked. */
export function buildServices(env: ApiEnv, fetchImpl?: typeof fetch): Services {
  const registry = createDefaultRegistry();
  let provider: AgentProvider | undefined;
  let github: GitHubClient | undefined;
  let sandbox: SandboxRunner | undefined;
  let builder: ProjectBuilderProvider | undefined;
  try { provider = new TinanAiProvider({ ...parseTinanAiConfig(env as Record<string, string | undefined>), fetch: fetchImpl }); } catch { /* not configured */ }
  if (env.TINANAI_BUILDER_ENABLED === 'true') {
    try { builder = new TinanAiBuilderProvider({ ...parseTinanAiConfig(env as Record<string, string | undefined>), fetch: fetchImpl }); } catch { /* not configured */ }
  }
  try { github = new GitHubClient({ ...parseGitHubConfig(env), fetch: fetchImpl }); } catch { /* not configured */ }
  try { sandbox = new RemoteSandboxClient({ ...parseSandboxConfig(env), fetch: fetchImpl }); } catch { /* not configured */ }
  const clock = () => new Date().toISOString();
  const builderFor = makeBuilderFactory(env, fetchImpl);
  const store = new D1WorkflowStore(env.DB as D1DatabaseLike);
  const audit = new D1AuditLog(env.DB as D1DatabaseLike);
  return {
    engine: new WorkflowEngine(store, audit, registry, clock), registry, github, provider, builder, sandbox, db: env.DB,
    builderProjects: new BuilderProjectService({
      store: new D1BuilderProjectStore(env.DB as D1DatabaseLike), audit, builderFor,
      authMode: env.TINANAI_DELEGATION_SECRET ? 'delegated' : 'single-owner', transport: env.TINANAI_SERVICE ? 'service-binding' : 'https',
    }),
    handlers: {
      'pr-delivery-v1': createPrDeliveryHandlers({ registry, provider, maxPromptChars: TINANAI_MAX_OBJECTIVE }),
      'builder-delivery-v1': createBuilderDeliveryHandlers({ registry, builder, github, sandbox }),
      'project-v1': {},
    },
    unavailable: { 'pr-delivery-v1': PR_DELIVERY_UNAVAILABLE, 'builder-delivery-v1': builderUnavailable({ builder: !!builder, github: !!github, sandbox: !!sandbox }) },
  };
}

/**
 * Per-user Builder clients for the native workspace. Credentials stay server-side; the user identity passed in is the verified
 * Access identity. Cloudflare Access headers are never forwarded to TINAN AI. With TINANAI_SERVICE the request travels over a
 * private Service Binding (the Basic credential and delegation are still sent); otherwise over authenticated HTTPS.
 */
export function makeBuilderFactory(env: ApiEnv, fetchImpl?: typeof fetch): (email: string) => BuilderClient | undefined {
  if (env.TINANAI_BUILDER_ENABLED !== 'true') return () => undefined;
  const service = env.TINANAI_SERVICE;
  const transport: typeof fetch | undefined = fetchImpl ?? (service ? ((input, init) => service.fetch(input, init)) as typeof fetch : undefined);
  let config: ReturnType<typeof parseTinanAiConfig>;
  try { config = parseTinanAiConfig(env as Record<string, string | undefined>); } catch { return () => undefined; }
  return (email) => {
    try {
      return new TinanAiBuilderProvider({
        ...config, fetch: transport, getRetries: 2,
        delegation: env.TINANAI_DELEGATION_SECRET ? { secret: env.TINANAI_DELEGATION_SECRET, subject: delegationSubjectFor(email) } : undefined,
      });
    } catch { return undefined; }
  };
}

/** Clear configuration messages for stages that have no handler. Nothing is generated, committed or simulated meanwhile. */
export function builderUnavailable(have: { builder: boolean; github: boolean; sandbox: boolean }): Record<string, string> {
  const out: Record<string, string> = {};
  const noBuilder = 'TINAN AI Builder generation is not enabled: set TINANAI_BUILDER_ENABLED=true together with TINANAI_BASE_URL, TINANAI_USERNAME and TINANAI_PASSWORD (server-side secrets) once the Builder contract is verified. No files were generated, committed or proposed.';
  const noGithub = 'GITHUB_TOKEN / GITHUB_ALLOWED_REPOS are not set; nothing was written to GitHub.';
  if (!have.builder) for (const id of ['builder-submit', 'builder-plan', 'builder-generation', 'commit']) out[id] = noBuilder;
  if (!have.github) for (const id of ['branch', 'commit', 'pull-request']) out[id] = out[id] ? `${out[id]} ${noGithub}` : noGithub;
  if (!have.sandbox) out.testing = 'No verified isolated sandbox runner is configured (SANDBOX_URL / SANDBOX_TOKEN). The generated files were not executed and no test result is claimed; the committed branch is a reviewable proposal only.';
  return out;
}

const HTTP: Record<string, number> = { INVALID_INPUT: 400, UNSUPPORTED: 400, UNAUTHORIZED: 403, INVALID_TRANSITION: 409, UNAVAILABLE: 503 };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
const err = (e: CoreError) => json({ error: e.message, code: e.code }, HTTP[e.code] ?? 400);

function view(w: WorkflowRecord) {
  const def = pipelineOf(w);
  const pendingGate = w.status === 'awaiting-approval' ? w.stages.find((s) => s.status === 'awaiting-approval') : undefined;
  return { ...w, stageDefinitions: def.map((d) => ({ id: d.id, title: d.title, kind: d.kind, level: d.level, acceptance: d.acceptance })), pendingApproval: pendingGate ? { stageId: pendingGate.id, digest: reviewDigest(w, pendingGate.id) } : null };
}

const can = (id: Identity, role: Role) => id.roles.includes(role);

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  if (!(request.headers.get('Content-Type') ?? '').toLowerCase().startsWith('application/json')) return null;
  const contentLength = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY) return null;
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BODY) {
          await reader.cancel();
          return null;
        }
        chunks.push(value);
      }
    } catch {
      return null;
    } finally {
      reader.releaseLock();
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  try {
    const v = JSON.parse(text || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

async function probeIntegrations(s: Services, env: ApiEnv, nowIso: string) {
  const result: Record<string, { status: string; detail: string; checkedAt: string | null }> = {};
  const set = (k: string, status: string, detail: string, checked = false) => { result[k] = { status, detail, checkedAt: checked ? nowIso : null }; };
  if (!s.db) set('database', 'not-configured', 'No D1 binding "DB".');
  else {
    try {
      const report = await verifySchema(s.db);
      if (report.compatible) set('database', 'healthy', 'D1 reachable; schema matches migrations 0001 and 0002.', true);
      else set('database', 'unhealthy', `Incompatible schema: ${report.problems.slice(0, 5).join('; ')}`, true);
    } catch { set('database', 'unhealthy', 'D1 query failed (binding or migrations missing).', true); }
  }
  if (!s.github) set('github', 'not-configured', 'GITHUB_TOKEN / GITHUB_ALLOWED_REPOS not set.');
  else {
    try {
      const first = (env.GITHUB_ALLOWED_REPOS ?? '').split(',')[0];
      const info = await s.github.getRepo(parseRepo(first));
      set('github', 'healthy', `Authenticated read of ${info.fullName} succeeded.`, true);
    } catch (e) { set('github', 'unhealthy', e instanceof Error ? e.message.slice(0, 150) : 'failed', true); }
  }
  set('tinanai', s.provider ? 'configured' : 'not-configured', s.provider ? 'Secrets present; not probed (no health endpoint is documented).' : 'TINANAI_* secrets not set.');
  set('tinanai-builder', s.builder ? 'configured' : 'not-configured', s.builder ? 'Builder generation enabled; not probed (no health endpoint is documented). Contract unverified live.' : 'TINANAI_BUILDER_ENABLED is not "true" or TINANAI_* secrets are missing; generation is blocked.');
  set('sandbox', s.sandbox ? 'configured' : 'not-configured', s.sandbox ? 'Runner URL/token present; not probed.' : 'SANDBOX_URL / SANDBOX_TOKEN not set.');
  return result;
}

/**
 * Native Builder routes. The owner is ALWAYS `id.email` from the verified Access token; no id in the URL, query or body can
 * select another user's data. Foreign and missing projects both answer 404.
 */
async function handleBuilder(bp: BuilderProjectService, request: Request, path: string, url: URL, id: Identity, readBody: (r: Request) => Promise<Record<string, unknown> | null>): Promise<Response> {
  const write = request.method === 'POST';
  if (path === '/api/builder/status' && !write) return json({ integration: await bp.status(id.email) });
  if (path === '/api/builder/history' && !write) return json({ history: await bp.history(id.email) });
  if (path === '/api/builder/projects' && !write) return json({ projects: await bp.list(id.email) });
  if (path === '/api/builder/projects' && write) {
    if (!can(id, 'operator')) return json({ error: 'Operator role required.' }, 403);
    const b = await readBody(request);
    if (!b) return json({ error: 'A JSON body up to 16 KB is required.' }, 400);
    return json({ project: await bp.create(id.email, { name: b.name, requirements: b.requirements }) }, 201);
  }
  const m = /^\/api\/builder\/projects\/([A-Za-z0-9-]{1,64})(?:\/([a-z]+))?$/.exec(path);
  if (!m || !PROJECT_ID.test(m[1])) return json({ error: 'Not found.' }, 404);
  const [, pid, action] = m;
  if (!write) {
    if (!action) return json(await bp.get(id.email, pid));
    if (action === 'history') return json({ history: await bp.history(id.email, pid) });
    if (action === 'file') return json({ file: await bp.file(id.email, pid, url.searchParams.get('path')) });
    if (action === 'export') {
      const z = await bp.exportZip(id.email, pid);
      return new Response(z.bytes, { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${z.filename}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
    }
    return json({ error: 'Not found.' }, 404);
  }
  const body = await readBody(request);
  if (!body) return json({ error: 'A JSON body up to 16 KB is required.' }, 400);
  // The approver is the verified identity; any identity in the body is ignored.
  if (action === 'approve') {
    if (!can(id, 'approver')) return json({ error: 'Approver role required.' }, 403);
    return json({ project: await bp.approve(id.email, pid, body.planDigest) });
  }
  if (!can(id, 'operator')) return json({ error: 'Operator role required.' }, 403);
  if (action === 'cancel') return json({ project: await bp.cancel(id.email, pid) });
  if (action === 'retry') return json({ project: await bp.retry(id.email, pid) });
  return json({ error: 'Not found.' }, 404);
}

export async function handleApi(request: Request, env: ApiEnv, overrides: ApiOverrides = {}): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return null;

  const auth = await authenticate(request, env, { fetch: overrides.fetch, now: overrides.now });
  if (!auth.ok) return json({ error: auth.message }, auth.status);
  const id = auth.identity;

  const isWrite = request.method !== 'GET';
  if (isWrite) {
    // Access authenticates by cookie, so require a same-origin Origin header to block cross-site requests.
    if (request.headers.get('Origin') !== url.origin) return json({ error: 'Cross-origin request refused.' }, 403);
  }
  if (request.method !== 'GET' && request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (isWrite && limited(id.email, (overrides.now ?? Date.now)())) {
    return new Response(JSON.stringify({ error: 'Too many requests.' }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60', 'Cache-Control': 'no-store' } });
  }

  const path = url.pathname.replace(/\/+$/, '');
  if (path === '/api/session') return json({ email: id.email, roles: id.roles });

  const services = overrides.services ?? (env.DB ? buildServices(env, overrides.fetch) : null);
  if (path === '/api/products' && request.method === 'GET') return json({ products: (services?.registry ?? createDefaultRegistry()).list() });
  if (!services) return json({ error: 'Persistence (D1 binding "DB") is not configured.' }, 503);
  if (!can(id, 'viewer')) return json({ error: 'Forbidden.' }, 403);
  const { engine } = services;
  const nowIso = new Date((overrides.now ?? Date.now)()).toISOString();

  try {
    if (path === '/api/builder' || path.startsWith('/api/builder/')) {
      const bp = services.builderProjects;
      if (!bp) return json({ error: 'Builder service is unavailable.', code: 'BUILDER_NOT_CONFIGURED' }, 503);
      try {
        return await handleBuilder(bp, request, path, url, id, readBody);
      } catch (e) {
        if (e instanceof BuilderApiError) return json({ error: e.message, code: e.code }, e.status);
        if (e instanceof Error && /no such table/i.test(e.message)) return json({ error: 'Builder storage is not migrated: apply migrations/0003_builder_projects.sql to the D1 database.', code: 'BUILDER_STORAGE_MISSING' }, 503);
        return json({ error: 'Internal error.' }, 500);
      }
    }

    if (path === '/api/integrations' && request.method === 'GET') return json({ integrations: await probeIntegrations(services, env, nowIso) });

    if (path === '/api/workflows' && request.method === 'GET') return json({ workflows: (await engine.list()).map(view) });

    if (path === '/api/approvals' && request.method === 'GET') {
      const pending = (await engine.list()).filter((w) => w.status === 'awaiting-approval').map(view).map((w) => ({
        workflowId: w.id, objective: w.objective, ...w.pendingApproval, review: Object.fromEntries(w.stages.filter((s) => s.output !== null).map((s) => [s.id, s.output])),
      }));
      return json({ approvals: pending });
    }

    if (path === '/api/audit' && request.method === 'GET') return json({ entries: (await new D1AuditLog(services.db as D1DatabaseLike).list()).slice(-200) });

    if (path === '/api/workflows' && request.method === 'POST') {
      if (!can(id, 'operator')) return json({ error: 'Operator role required.' }, 403);
      const b = await readBody(request);
      if (!b) return json({ error: 'A JSON body up to 16 KB is required.' }, 400);
      const level = b.grantedLevel === undefined ? 2 : b.grantedLevel;
      if (!isPermissionLevel(level) || level > MAX_AUTONOMOUS_LEVEL) return json({ error: `grantedLevel must be 1-${MAX_AUTONOMOUS_LEVEL}.` }, 400);
      if (b.pipeline !== undefined && (typeof b.pipeline !== 'string' || !(b.pipeline in PIPELINES))) return json({ error: 'Unknown pipeline.' }, 400);
      const r = await engine.create({ id: String(b.id), objective: String(b.objective ?? ''), productId: typeof b.productId === 'string' ? b.productId : undefined, grantedLevel: level, pipeline: b.pipeline as PipelineId | undefined }, id.email);
      return r.ok ? json({ workflow: view(r.value) }, 201) : err(r.error);
    }

    const m = /^\/api\/workflows\/([A-Za-z0-9._:-]{1,128})(?:\/([a-z]+))?$/.exec(path);
    if (!m) return json({ error: 'Not found.' }, 404);
    const [, wid, action] = m;

    if (request.method === 'GET') {
      const w = await engine.get(wid);
      if (!w) return json({ error: 'Not found.' }, 404);
      if (action === 'audit') return json({ entries: await new D1AuditLog(services.db as D1DatabaseLike).list(wid) });
      return action ? json({ error: 'Not found.' }, 404) : json({ workflow: view(w) });
    }

    const body = await readBody(request);
    if (!body) return json({ error: 'A JSON body up to 16 KB is required.' }, 400);
    const done = (r: { ok: true; value: WorkflowRecord } | { ok: false; error: CoreError }) => (r.ok ? json({ workflow: view(r.value) }) : err(r.error));

    // The approver identity below always comes from the verified token; any identity in the body is ignored.
    if (action === 'approve' || action === 'reject') {
      if (!can(id, 'approver')) return json({ error: 'Approver role required.' }, 403);
      if (typeof body.stageId !== 'string') return json({ error: 'stageId is required.' }, 400);
      return done(action === 'approve'
        ? await engine.approve(wid, body.stageId, id.email, String(body.digest ?? ''))
        : await engine.reject(wid, body.stageId, id.email, String(body.reason ?? '')));
    }
    if (!can(id, 'operator')) return json({ error: 'Operator role required.' }, 403);
    if (action === 'cancel') {
      const before = await engine.get(wid);
      const r = await engine.cancel(wid, id.email);
      if (r.ok && before?.pipeline === 'builder-delivery-v1' && services.builder) {
        // The task id comes only from this workflow's own stored stage output, never from the request.
        try {
          const out = before.stages.find((s) => s.id === 'builder-submit')?.output;
          const taskId = out ? (JSON.parse(out) as { taskId?: unknown }).taskId : undefined;
          if (typeof taskId === 'string') await services.builder.cancel(taskId);
        } catch { /* best effort: the workflow is already cancelled and late results are discarded */ }
      }
      return done(r);
    }
    if (action === 'retry') return done(await engine.retry(wid, id.email));
    if (action === 'recover') return done(await engine.recover(wid));
    if (action === 'advance') {
      const w = await engine.get(wid);
      if (!w) return json({ error: 'Not found.' }, 404);
      return done(await engine.advance(wid, services.handlers[w.pipeline ?? 'project-v1'] ?? {}, { timeoutMs: 25_000, unavailable: services.unavailable?.[w.pipeline ?? 'project-v1'] }));
    }
    return json({ error: 'Not found.' }, 404);
  } catch {
    return json({ error: 'Internal error.' }, 500);
  }
}
