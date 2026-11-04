import type { AgentProvider } from '../core/agent';
import { MAX_AUTONOMOUS_LEVEL, isPermissionLevel } from '../core/permissions';
import { createDefaultRegistry, type ProductRegistry } from '../core/registry';
import { PIPELINES, WorkflowEngine, pipelineOf, reviewDigest, type PipelineId, type StageHandler, type WorkflowRecord } from '../core/workflow';
import type { CoreError } from '../core/errors';
import { authenticate, type AuthEnv, type Identity, type Role } from './auth';
import { D1AuditLog, D1WorkflowStore, type D1DatabaseLike } from './d1';
import { createPrDeliveryHandlers } from './executors';
import { GitHubClient, parseGitHubConfig, parseRepo } from './github';
import { RemoteSandboxClient, parseSandboxConfig, type SandboxRunner } from './sandbox';
import { TINANAI_MAX_OBJECTIVE, TinanAiProvider, parseTinanAiConfig } from './tinanai-provider';

export type ApiEnv = AuthEnv & {
  DB?: D1DatabaseLike;
  TINANAI_BASE_URL?: string; TINANAI_USERNAME?: string; TINANAI_PASSWORD?: string;
  GITHUB_TOKEN?: string; GITHUB_ALLOWED_REPOS?: string;
  SANDBOX_URL?: string; SANDBOX_TOKEN?: string;
};

export type Services = {
  engine: WorkflowEngine;
  registry: ProductRegistry;
  handlers: Record<string, Record<string, StageHandler>>;
  github?: GitHubClient;
  provider?: AgentProvider;
  sandbox?: SandboxRunner;
  db?: D1DatabaseLike;
};

export type ApiOverrides = { fetch?: typeof fetch; now?: () => number; services?: Services };

const MAX_BODY = 16_384;

/** Builds services from server-side bindings only. Missing configuration means the capability is absent; nothing is mocked. */
export function buildServices(env: ApiEnv, fetchImpl?: typeof fetch): Services {
  const registry = createDefaultRegistry();
  let provider: AgentProvider | undefined;
  let github: GitHubClient | undefined;
  let sandbox: SandboxRunner | undefined;
  try { provider = new TinanAiProvider({ ...parseTinanAiConfig(env as Record<string, string | undefined>), fetch: fetchImpl }); } catch { /* not configured */ }
  try { github = new GitHubClient({ ...parseGitHubConfig(env), fetch: fetchImpl }); } catch { /* not configured */ }
  try { sandbox = new RemoteSandboxClient({ ...parseSandboxConfig(env), fetch: fetchImpl }); } catch { /* not configured */ }
  const clock = () => new Date().toISOString();
  const store = new D1WorkflowStore(env.DB as D1DatabaseLike);
  const audit = new D1AuditLog(env.DB as D1DatabaseLike);
  return {
    engine: new WorkflowEngine(store, audit, registry, clock), registry, github, provider, sandbox, db: env.DB,
    handlers: { 'pr-delivery-v1': createPrDeliveryHandlers({ registry, provider, github, sandbox, maxPromptChars: TINANAI_MAX_OBJECTIVE }), 'project-v1': {} },
  };
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
  const text = await request.text();
  if (text.length > MAX_BODY) return null;
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
      await s.db.prepare('SELECT COUNT(*) AS n FROM workflows').first();
      await s.db.prepare('SELECT COUNT(*) AS n FROM audit_log').first();
      await s.db.prepare('SELECT COUNT(*) AS n FROM agent_tasks').first();
      set('database', 'healthy', 'D1 reachable; migrations 0001 and 0002 tables present.', true);
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
  set('sandbox', s.sandbox ? 'configured' : 'not-configured', s.sandbox ? 'Runner URL/token present; not probed.' : 'SANDBOX_URL / SANDBOX_TOKEN not set.');
  return result;
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

  const path = url.pathname.replace(/\/+$/, '');
  if (path === '/api/session') return json({ email: id.email, roles: id.roles });

  const services = overrides.services ?? (env.DB ? buildServices(env, overrides.fetch) : null);
  if (path === '/api/products' && request.method === 'GET') return json({ products: (services?.registry ?? createDefaultRegistry()).list() });
  if (!services) return json({ error: 'Persistence (D1 binding "DB") is not configured.' }, 503);
  if (!can(id, 'viewer')) return json({ error: 'Forbidden.' }, 403);
  const { engine } = services;
  const nowIso = new Date((overrides.now ?? Date.now)()).toISOString();

  try {
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
      const r = await engine.create({ id: String(b.id), objective: String(b.objective ?? ''), productId: typeof b.productId === 'string' ? b.productId : undefined, grantedLevel: level, pipeline: b.pipeline as PipelineId | undefined });
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
    if (action === 'cancel') return done(await engine.cancel(wid));
    if (action === 'retry') return done(await engine.retry(wid));
    if (action === 'recover') return done(await engine.recover(wid));
    if (action === 'advance') {
      const w = await engine.get(wid);
      if (!w) return json({ error: 'Not found.' }, 404);
      return done(await engine.advance(wid, services.handlers[w.pipeline ?? 'project-v1'] ?? {}, { timeoutMs: 25_000 }));
    }
    return json({ error: 'Not found.' }, 404);
  } catch {
    return json({ error: 'Internal error.' }, 500);
  }
}
